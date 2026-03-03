import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapSidebarComponent } from '../map-sidebar/map-sidebar.component';
import { MapLegendComponent } from '../map-legend/map-legend.component';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { WeatherForecast } from '../../model/forecast.model';
import { WeatherService } from '../../services/weather.service';
import { LocationService } from '../../services/location.service';
import { LocationMatcherService } from '../../services/location-matcher.service';
import { MapService } from '../../services/map.service';
import { WeatherUtils } from '../../utils/weather-utils';

@Component({
  selector: 'app-weather-map',
  imports: [CommonModule, FormsModule, MapSidebarComponent, MapLegendComponent],
  templateUrl: './weather-map.component.html',
  styleUrl: './weather-map.component.css'
})
export class WeatherMapComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private destroy$ = new Subject<void>();
  private apiLoaded = false;
  forecasts: WeatherForecast[] = [];
  selectedForecast: WeatherForecast | null = null;
  filteredDate: string = '';
  uniqueDates: string[] = [];
  todayLabel = '';
  mapError = false;
  
  // Enhanced loading states
  isLoading = true;
  isWeatherLoading = false; // New flag for weather data loading
  locationsLoaded = false;
  weatherLoaded = false;
  mapLoaded = false;
  locationsCount = 0;
  loadingMessage = 'Memulakan...';
  
  locationsLoading = false;
  locationsError: string | null = null;

  selectedLocationType: string = 'all';
  locationTypes = [
    { value: 'all', label: 'Semua' },
    { value: 'St', label: 'Negeri' },
    { value: 'Rc', label: 'Pusat Rekreasi' },
    { value: 'Ds', label: 'Daerah' },
    { value: 'Tn', label: 'Bandar' },
    { value: 'Dv', label: 'Bahagian' }
  ];

  constructor(
    private weatherService: WeatherService,
    private locationService: LocationService,
    private locationMatcher: LocationMatcherService,
    private mapService: MapService
  ) { }

  ngOnInit(): void {
    this.todayLabel = new Date().toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    this.loadLocations();
    this.checkGoogleMapsLoaded();
  }

  ngAfterViewInit(): void {
    if (this.apiLoaded) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadLocations(): Promise<void> {
    this.locationsLoading = true;
    this.locationsError = null;
    this.loadingMessage = 'Memuatkan lokasi...';

    try {
      const response = await firstValueFrom(this.locationService.getLocations());
      if (response?.items && Array.isArray(response.items)) {
        this.locationMatcher.setLocations(response.items);
        this.locationsCount = response.items.length;
        this.locationsLoaded = true;
        console.log(`Successfully loaded ${response.items.length} locations`);
        this.loadingMessage = 'Lokasi dijumpai, memuatkan data cuaca...';
      } else {
        this.locationsError = 'Invalid response format from server';
      }
    } catch (error) {
      console.error('Error loading locations:', error);
      this.locationsError = error instanceof Error ? error.message : 'Unknown error loading locations';
    } finally {
      this.locationsLoading = false;
      this.loadWeatherData();
    }
  }

  private loadWeatherData(): void {
    this.isWeatherLoading = true; // Set weather loading flag
    this.loadingMessage = 'Memproses ramalan cuaca...';
    
    this.weatherService.getForecast()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.forecasts = data;
          this.weatherLoaded = true;
          this.isWeatherLoading = false; // Clear weather loading flag
          this.uniqueDates = [...new Set(data.map(f => f.date))].sort();
          
          if (this.forecasts.length > 0) {
            this.loadingMessage = 'Menjana peta interaktif...';
          } else {
            // If no data received but API call succeeded
            this.loadingMessage = 'Tiada data cuaca ditemui';
          }
          
          if (this.mapService.getMap()) {
            this.updateMarkers();
          }
          this.finalizeLoadingIfReady();
        },
        error: (error) => {
          console.error('Error loading weather data:', error);
          this.locationsError = 'Error loading weather data';
          this.isWeatherLoading = false; // Clear weather loading flag on error
          this.isLoading = false; // Also clear main loading flag
        }
      });
  }

  private checkGoogleMapsLoaded(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.apiLoaded = true;
      this.initMap();
    } else {
      window.addEventListener('load', () => {
        if (typeof google !== 'undefined' && google.maps) {
          this.apiLoaded = true;
          this.initMap();
        }
      });
    }
  }

  private finalizeLoadingIfReady(): void {
    if (this.mapLoaded && this.weatherLoaded) {
      setTimeout(() => (this.isLoading = false), 300);
    }
  }

  private async initMap(): Promise<void> {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      this.mapError = true;
      this.isLoading = false;
      return;
    }

    const success = await this.mapService.initializeMap(mapElement);
    this.mapError = !success;
    
    if (success) {
      this.mapLoaded = true;
      this.loadingMessage = 'Sedia!';
      
      if (this.forecasts.length > 0) {
        this.updateMarkers();
      }
      
      // All data is loaded, hide loading screen
      // But only if weather data is also loaded
      if (success) {
        this.mapLoaded = true;
        this.loadingMessage = 'Sedia!';
        if (this.forecasts.length > 0) this.updateMarkers();
      
        this.finalizeLoadingIfReady();
      }
      if (this.weatherLoaded) {
        setTimeout(() => {
          this.isLoading = false;
        }, 500); // Small delay for smooth transition
      }
    } else {
      this.isLoading = false;
    }
  }

  private updateMarkers(): void {
    const locationGroups = WeatherUtils.groupForecastsByLocation(this.forecasts);
    const locations = this.prepareLocationData(locationGroups);

    this.mapService.addMarkers(locations, (forecast, allForecasts) => {
      this.selectedForecast = forecast;
    });
  }

  private prepareLocationData(groups: Map<string, WeatherForecast[]>): Array<{
    name: string;
    coords: { lat: number; lng: number };
    forecasts: WeatherForecast[];
  }> {
    const result = [];

    for (const [name, forecasts] of groups.entries()) {
      const coords = this.locationMatcher.findCoordinates(name);

      if (coords) {
        result.push({ name, coords, forecasts });
      } else {
        console.warn(`No coordinates found for location: ${name}`);
      }
    }
    return result;
  }

  onDateFilter(date: string): void {
    this.filteredDate = date;
    if (!date) {
      this.updateMarkers();
      return;
    }
    const dateForecasts = new Map(
      this.forecasts
        .filter(f => f.date === date)
        .map(f => [f.location.location_name, f])
    );
    const visibleLocations = new Set(dateForecasts.keys());
    this.mapService.filterMarkers(visibleLocations, dateForecasts);
  }

  onLocationTypeFilter(type: string): void {
    this.selectedLocationType = type;
    const groups = WeatherUtils.groupForecastsByLocation(this.forecasts);
    const visibleLocations = new Set<string>();
    for (const [name, forecasts] of groups.entries()) {
      if (type === 'all') {
        visibleLocations.add(name);
      } else {
        const sample = forecasts[0];
        const locationId = sample.location.location_id || '';
        if (locationId.startsWith(type)) {
          visibleLocations.add(name);
        }
      }
    }
    this.mapService.filterMarkers(visibleLocations);
  }

  onResetFilter(): void {
    this.filteredDate = '';
    this.selectedLocationType = 'all';
    this.updateMarkers();
  }

  onLocationSelect(location: string): void {
    const forecasts = this.forecasts.filter(f => f.location.location_name === location);
    if (forecasts.length > 0) {
      this.selectedForecast = WeatherUtils.getLatestForecast(forecasts);
    }
  }

  async centerOnUserLocation(): Promise<void> {
    await this.mapService.centerOnUserLocation(this.mapService.getMap());
  }

  getLocationsWithForecast(): string[] {
    return Array.from(WeatherUtils.groupForecastsByLocation(this.forecasts).keys());
  }

  retryLoadMap(): void {
    this.mapError = false;
    this.checkGoogleMapsLoaded();
  }

  retryLoadLocations(): void {
    this.locationsError = null;
    this.isLoading = true;
    this.isWeatherLoading = true;
    this.locationsLoaded = false;
    this.weatherLoaded = false;
    this.mapLoaded = false;
    this.forecasts = [];
    this.loadLocations();
  }

  refreshWeatherData(): void {
    this.forecasts = [];
    this.isLoading = true;
    this.isWeatherLoading = true;
    this.weatherLoaded = false;
    this.loadWeatherData();
  }

  getLocationStats() {
    return this.locationMatcher.getLocationStats(this.getLocationsWithForecast());
  }
}