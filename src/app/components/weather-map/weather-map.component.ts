import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapLegendComponent } from '../map-legend/map-legend.component';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { WeatherForecast } from '../../model/forecast.model';
import { WeatherService } from '../../services/weather.service';
import { LocationService } from '../../services/location.service';
import { LocationMatcherService } from '../../services/location-matcher.service';
import { MapService } from '../../services/map.service';
import { WeatherUtils } from '../../utils/weather-utils';
import { WeatherCardsComponent } from '../weather-cards/weather-cards.component';
import { MotorcycleCommuterComponent } from '../motorcycle-commuter/motorcycle-commuter.component';
import { CommuteResultComponent } from '../commute-result/commute-result.component';
import { CommuterSchedule, HourlyWeather, JourneyTime, MapLocation } from '../../model/motorcycle.model';
import { MotorcycleCommuterService } from '../../services/motorcycle-commuter.service';

@Component({
  selector: 'app-weather-map',
  imports: [CommonModule, FormsModule, WeatherCardsComponent, MapLegendComponent, MotorcycleCommuterComponent, CommuteResultComponent],
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
  isWeatherLoading = false;
  locationsLoaded = false;
  weatherLoaded = false;
  mapLoaded = false;
  locationsCount = 0;
  loadingMessage = 'Memulakan...';
  locationsLoading = false;
  locationsError: string | null = null;

  selectedLocationType: string = 'Ds';
  locationTypes = [
    { value: 'Ds', label: 'Daerah' },
  ];

  commuterWeekDays: CommuterSchedule[] = [];
  commuterHomeToWork: JourneyTime = { departure: '08:00', arrival: '09:00' };
  commuterWorkToHome: JourneyTime = { departure: '17:00', arrival: '18:00' };
  commuterShowResults = false;
  commuterHomeLocation: MapLocation | null = null;
  commuterWorkLocation: MapLocation | null = null;

  constructor(
    private weatherService: WeatherService,
    private locationService: LocationService,
    private locationMatcher: LocationMatcherService,
    private mapService: MapService,
    private motorcycleService: MotorcycleCommuterService
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
          this.isWeatherLoading = false;
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
    const result: Array<{ name: string; coords: { lat: number; lng: number }; forecasts: WeatherForecast[] }> = [];

    const seenNames = new Set<string>();
    const seenCoords = new Set<string>();

    const coordKey = (c: { lat: number; lng: number }) =>
      `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`; // rounding avoids tiny float diffs

    for (const [name, forecasts] of groups.entries()) {
      const nameKey = name.toLowerCase().trim().replace(/\s+/g, ' ');
      if (seenNames.has(nameKey)) continue;

      const coords = this.locationMatcher.findCoordinates(name);
      if (!coords) continue;

      const cKey = coordKey(coords);
      if (seenCoords.has(cKey)) {
        continue;
      }

      seenNames.add(nameKey);
      seenCoords.add(cKey);
      result.push({ name, coords, forecasts });
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
    this.selectedLocationType = 'Ds';
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

  showMotorcycleRoute(event: {
    home: { name: string; lat: number; lng: number; address: string };
    work: { name: string; lat: number; lng: number; address: string };
    homeToWorkTime: string;
    workToHomeTime: string;
  }) {
    if (this.mapService.getMap()) {
      this.mapService.clearRoutes();

      this.mapService.showRoute(
        { lat: event.home.lat, lng: event.home.lng },
        { lat: event.work.lat, lng: event.work.lng },
        `🏠 → 🏢 (${event.homeToWorkTime})`, '#3B82F6'
      );

      // Show route from work to home (balik)
      this.mapService.showRoute(
        { lat: event.work.lat, lng: event.work.lng },
        { lat: event.home.lat, lng: event.home.lng },
        `🏢 → 🏠 (${event.workToHomeTime})`, '#EF4444'
      );

      // Fit bounds to show both routes
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: event.home.lat, lng: event.home.lng });
      bounds.extend({ lat: event.work.lat, lng: event.work.lng });
      this.mapService.getMap()?.fitBounds(bounds);
    }
  }

  async onCommuterCalculate(event: {
    homeLocation: MapLocation;
    workLocation: MapLocation;
    homeToWork: JourneyTime;
    workToHome: JourneyTime;
    weekDays: any[];
  }) {
    this.commuterHomeLocation = event.homeLocation;
    this.commuterWorkLocation = event.workLocation;
    this.commuterHomeToWork = event.homeToWork;
    this.commuterWorkToHome = event.workToHome;

    // Convert weekDays to CommuterSchedule with rainProbability
    this.commuterWeekDays = event.weekDays.map(day => ({
      ...day,
      rainProbability: { homeToWork: 0, workToHome: 0 }
    }));

    await this.calculateCommuterRainProbability();
    this.commuterShowResults = true;
  }

  async calculateCommuterRainProbability() {
    if (!this.commuterHomeLocation || !this.commuterWorkLocation) return;

    try {
      const [homeHourly, workHourly] = await Promise.all([
        firstValueFrom(this.motorcycleService.getHourlyForecast(
          this.commuterHomeLocation.lat,
          this.commuterHomeLocation.lng
        )),
        firstValueFrom(this.motorcycleService.getHourlyForecast(
          this.commuterWorkLocation.lat,
          this.commuterWorkLocation.lng
        ))
      ]);

      this.commuterWeekDays.forEach(day => {
        if (day.isWorking) {
          const date = this.getDateWithinWeek(day.day);

          day.rainProbability.homeToWork = this.calculateJourneyRainProbability(
            homeHourly,
            workHourly,
            date,
            this.commuterHomeToWork.departure,
            this.commuterHomeToWork.arrival
          );

          day.rainProbability.workToHome = this.calculateJourneyRainProbability(
            workHourly,
            homeHourly,
            date,
            this.commuterWorkToHome.departure,
            this.commuterWorkToHome.arrival
          );
        }
      });

    } catch (error) {
      console.error('Error calculating rain probability:', error);
    }
  }

  private calculateJourneyRainProbability(
    startHourly: HourlyWeather,
    endHourly: HourlyWeather,
    date: string,
    departureTime: string,
    arrivalTime: string
  ): number {
    const departureHour = parseInt(departureTime.split(':')[0]);
    const arrivalHour = parseInt(arrivalTime.split(':')[0]);

    const startIndex = this.findHourlyIndex(startHourly.time, date, departureHour);
    const endIndex = this.findHourlyIndex(endHourly.time, date, arrivalHour);

    if (startIndex === -1 || endIndex === -1) return 0;

    const startProb = startHourly.precipitation_probability[startIndex];
    const endProb = endHourly.precipitation_probability[endIndex];

    let totalProb = startProb + endProb;
    let count = 2;

    const duration = arrivalHour - departureHour;
    if (duration > 1) {
      for (let hour = 1; hour < duration; hour++) {
        const midIndex = this.findHourlyIndex(startHourly.time, date, departureHour + hour);
        if (midIndex !== -1) {
          totalProb += startHourly.precipitation_probability[midIndex];
          count++;
        }
      }
    }

    return Math.round(totalProb / count);
  }

  private findHourlyIndex(timeArray: string[], date: string, hour: number): number {
    const hourStr = hour.toString().padStart(2, '0');
    const targetTime = `${date}T${hourStr}:00`;
    return timeArray.findIndex(time => time === targetTime);
  }

  private getDateWithinWeek(day: string): string {
    const today = new Date();
    const targetDayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
    const todayIndex = today.getDay();

    let daysToAdd = targetDayIndex - todayIndex;
    if (daysToAdd < 0) daysToAdd += 7;
    if (daysToAdd >= 7) daysToAdd = daysToAdd % 7;

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);

    return targetDate.toISOString().split('T')[0];
  }

  onCommuterShowRoute() {
    if (this.commuterHomeLocation && this.commuterWorkLocation) {
      this.showMotorcycleRoute({
        home: this.commuterHomeLocation,
        work: this.commuterWorkLocation,
        homeToWorkTime: `${this.commuterHomeToWork.departure} - ${this.commuterHomeToWork.arrival}`,
        workToHomeTime: `${this.commuterWorkToHome.departure} - ${this.commuterWorkToHome.arrival}`
      });
    }
  }

}