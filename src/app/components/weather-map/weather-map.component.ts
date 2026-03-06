import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-weather-map',
  imports: [CommonModule, FormsModule, WeatherCardsComponent, MotorcycleCommuterComponent, CommuteResultComponent, ThemeToggleComponent],
  templateUrl: './weather-map.component.html',
  styleUrl: './weather-map.component.css'
})
export class WeatherMapComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @ViewChild(MotorcycleCommuterComponent) motorcycleCommuter!: MotorcycleCommuterComponent;

  private destroy$ = new Subject<void>();
  private apiLoaded = false;
  forecasts: WeatherForecast[] = [];
  selectedForecast: WeatherForecast | null = null;
  filteredDate: string = '';
  uniqueDates: string[] = [];
  todayLabel = '';
  mapError = false;
  showRouteHomeWork = false;

  commuterLoadingMessage = '';
  locationsLoading = false;
  locationsError: string | null = null;
  isLoading = true;
  isWeatherLoading = true;
  locationsLoaded = false;
  weatherLoaded = false;
  mapLoaded = false;
  locationsCount = 0;
  loadingMessage = 'Memulakan...';
  isDarkMode = false;

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
  currentLocationWeather: HourlyWeather | null = null;
  currentLocationName: string = '';
  currentWeatherLoading = false;
  currentHourIndex: number = 0;
  currentWeatherError: string | null = null;

  constructor(
    private weatherService: WeatherService,
    private locationService: LocationService,
    private locationMatcher: LocationMatcherService,
    private mapService: MapService,
    private motorcycleService: MotorcycleCommuterService,
    private themeService: ThemeService
  ) {
    this.themeService.currentTheme$.subscribe(theme => {
      this.isDarkMode = theme === 'dark';
    });

  }

  async ngOnInit(): Promise<void> {
    this.todayLabel = new Date().toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    this.loadLocations();
    this.checkGoogleMapsLoaded();
    this.findCurrentHourIndex();
    this.fetchCurrentLocationWeather();
    try {
      await this.waitForGoogleMaps();
    } catch (e) {
      console.warn('Google Maps not ready yet. Will skip reverse geocode.', e);
    }

  }

  ngAfterViewInit(): void {
    if (this.apiLoaded) {
      this.initMap();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentLocationWeather'] && this.currentLocationWeather) {
      this.findCurrentHourIndex();
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
        this.loadingMessage = 'Lokasi dijumpai, memuatkan data cuaca...';
      } else {
        this.locationsError = 'Invalid response format from server';
      }
    } catch (error) {
      this.locationsError = error instanceof Error ? error.message : 'Unknown error loading locations';
    } finally {
      this.locationsLoading = false;
      this.loadWeatherData();
    }
  }

  private waitForGoogleMaps(timeoutMs = 15000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if ((window as any).google?.maps) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('Google Maps not loaded'));
        setTimeout(tick, 100);
      };
      tick();
    });
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
    const forecasts = this.forecasts.filter(
      f => f.location.location_name === location
    );
    if (forecasts.length === 0) return;
    this.selectedForecast = WeatherUtils.getLatestForecast(forecasts);
    const ok = this.mapService.focusLocation(location);
    if (ok) {
      this.scrollToMap();
      return;
    }

    const map = this.mapService.getMap();
    if (!map) return;

    const coords = this.locationMatcher.findCoordinates(location);
    if (coords) {
      map.panTo(coords);
      const z = map.getZoom() ?? 6;
      if (z < 7) map.setZoom(8);
      this.scrollToMap();
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { address: `${location}, Malaysia` },
      (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const pos = results[0].geometry.location;

          const latLng = {
            lat: pos.lat(),
            lng: pos.lng()
          };
          map.panTo(latLng);
          map.setZoom(9);

        } else {
          console.error(
            `Geocode failed for "${location}"`,
            status
          );
        }
      }
    );

    this.scrollToMap();
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

    this.commuterWeekDays = event.weekDays.map(day => ({
      ...day,
      rainProbability: { homeToWork: 0, workToHome: 0 }
    }));

    this.commuterShowResults = true;

    this.calculateCommuterRainProbability().catch(error => {
      console.error('Error calculating rain probability:', error);
    });
  }

  async calculateCommuterRainProbability() {
    if (!this.commuterHomeLocation || !this.commuterWorkLocation) return;

    try {
      this.commuterLoadingMessage = 'Memproses data untuk lokasi rumah...';
      const homeHourly = await firstValueFrom(this.motorcycleService.getHourlyForecast(
        this.commuterHomeLocation.lat,
        this.commuterHomeLocation.lng
      ));

      this.commuterLoadingMessage = 'Memproses data untuk lokasi kerja...';
      const workHourly = await firstValueFrom(this.motorcycleService.getHourlyForecast(
        this.commuterWorkLocation.lat,
        this.commuterWorkLocation.lng
      ));

      this.commuterLoadingMessage = 'Mengira kebarangkalian hujan...';

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

  getCommuterProgress(): string {
    if (this.commuterLoadingMessage.includes('rumah')) return '33%';
    if (this.commuterLoadingMessage.includes('kerja')) return '66%';
    if (this.commuterLoadingMessage.includes('Mengira')) return '90%';
    return '50%';
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
    this.showRouteHomeWork = true;
    if (this.commuterHomeLocation && this.commuterWorkLocation) {
      this.showMotorcycleRoute({
        home: this.commuterHomeLocation,
        work: this.commuterWorkLocation,
        homeToWorkTime: `${this.commuterHomeToWork.departure} - ${this.commuterHomeToWork.arrival}`,
        workToHomeTime: `${this.commuterWorkToHome.departure} - ${this.commuterWorkToHome.arrival}`
      });
      this.scrollToMap();
    }
  }

  async fetchCurrentLocationWeather() {
    if (!navigator.geolocation) {
      this.currentWeatherError = 'Geolocation tidak disokong';
      return;
    }

    this.currentWeatherLoading = true;
    this.currentWeatherError = null;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          if ((window as any).google?.maps?.Geocoder) {

            // Reverse geocode to get location name
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
              if (status === 'OK' && results?.length) {
                const best = results.find(r => !this.isPlusCode((r.formatted_address ?? '').split(',')[0].trim())) ?? results[0];
                this.currentLocationName = this.pickBestLocationName(best);
              } else {
                this.currentLocationName = 'Lokasi Semasa';
              }
            });
          } else {
            this.currentLocationName = 'Lokasi Semasa';
          }
          // Fetch weather data
          const weather = await firstValueFrom(
            this.motorcycleService.getHourlyForecast(latitude, longitude)
          );

          this.currentLocationWeather = weather;
        } catch (error) {
          console.error('Error fetching current location weather:', error);
          this.currentWeatherError = 'Gagal memuatkan data cuaca';
        } finally {
          this.currentWeatherLoading = false;
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        this.currentWeatherError = 'Gagal mendapatkan lokasi';
        this.currentWeatherLoading = false;
      }
    );
  }

  private findCurrentHourIndex() {
    if (!this.currentLocationWeather?.time) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDateStr = now.toISOString().split('T')[0];

    // Find index closest to current time
    this.currentHourIndex = this.currentLocationWeather.time.findIndex(time => {
      return time.includes(currentDateStr) && parseInt(time.split('T')[1].split(':')[0]) >= currentHour;
    });

    if (this.currentHourIndex === -1) {
      this.currentHourIndex = 0;
    }
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('ms-MY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private isPlusCode(text: string): boolean {
    return /\+/.test(text) && /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/i.test(text.trim());
  }

  private pickBestLocationName(result: any): string {
    const comps = result.address_components ?? [];

    const get = (type: string) =>
      comps.find((c: any) => c.types?.includes(type))?.long_name as string | undefined;

    const candidate =
      get('premise') ||                         // condo/building name (if exists)
      get('point_of_interest') ||               // POI
      get('establishment') ||                   // place name
      get('route') ||                           // street name
      get('sublocality_level_1') ||             // area
      get('neighborhood') ||                    // neighborhood
      get('locality') ||                        // city
      get('administrative_area_level_2') ||     // district
      get('administrative_area_level_1');       // state

    if (candidate) return candidate;

    const formatted = (result.formatted_address ?? '').trim();
    if (!formatted) return 'Lokasi Semasa';
    const firstPart = formatted.split(',')[0].trim();
    if (this.isPlusCode(firstPart)) {
      return formatted.split(',')[1]?.trim() || 'Lokasi Semasa';
    }
    return firstPart || 'Lokasi Semasa';
  }

  getCurrentTemperature(): number {
    return this.currentLocationWeather?.temperature_2m[this.currentHourIndex] || 0;
  }

  getApparentTemperature(): number {
    return (this.currentLocationWeather as any)?.apparent_temperature?.[this.currentHourIndex] || this.getCurrentTemperature();
  }

  getCurrentRainProbability(): number {
    return this.currentLocationWeather?.precipitation_probability[this.currentHourIndex] || 0;
  }

  getCurrentWindSpeed(): number {
    return (this.currentLocationWeather as any)?.windspeed_10m?.[this.currentHourIndex] || 0;
  }

  getCurrentWindGust(): number {
    return (this.currentLocationWeather as any)?.windgusts_10m?.[this.currentHourIndex] || 0;
  }

  getCurrentVisibility(): number {
    return ((this.currentLocationWeather as any)?.visibility?.[this.currentHourIndex] / 1000) || 10;
  }

  getRainGradientClass(probability: number): string {
    if (probability < 30) return 'bg-gradient-to-r from-green-400 to-green-500';
    if (probability < 60) return 'bg-gradient-to-r from-yellow-400 to-yellow-500';
    return 'bg-gradient-to-r from-red-400 to-red-500';
  }

  getWeatherIcon(): string {
    const rainProb = this.getCurrentRainProbability();
    const temp = this.getCurrentTemperature();

    if (rainProb > 70) return '🌧️';
    if (rainProb > 40) return '☁️🌧️';
    if (rainProb > 10) return '☁️';
    if (temp > 32) return '☀️🔥';
    return '🌤️';
  }

  getWeatherCondition(): string {
    const rainProb = this.getCurrentRainProbability();
    if (rainProb > 70) return 'Hujan Lebat';
    if (rainProb > 40) return 'Hujan Ringan';
    if (rainProb > 10) return 'Mendung';
    return 'Cerah';
  }

  getWeatherDescription(): string {
    const rainProb = this.getCurrentRainProbability();
    const temp = this.getCurrentTemperature();

    if (rainProb > 70) return 'Bawa payung, elak perjalanan';
    if (rainProb > 40) return 'Berpotensi hujan, bawa payung';
    if (temp > 32) return 'Cuaca panas, minum air secukupnya';
    return 'Cuaca sesuai untuk perjalanan';
  }

  getNextHoursRange(): string {
    const startHour = new Date().getHours();
    return `${startHour}:00 - ${startHour + 3}:00`;
  }

  getHourLabel(index: number): string {
    switch (index) {
      case 0:
        return 'Sekarang';
      case 1:
        return '+1 jam';
      case 2:
        return '+2 jam';
      default:
        return '';
    }
  }

  getNext3Hours(): Array<{ time: string; icon: string; temp: number; rain: number }> {
    if (!this.currentLocationWeather) return [];

    const result = [];
    for (let i = 0; i < 3; i++) {
      const index = this.currentHourIndex + i;
      if (index < this.currentLocationWeather.time.length) {
        const timeStr = this.currentLocationWeather.time[index];
        const hour = parseInt(timeStr.split('T')[1].split(':')[0]);
        const rainProb = this.currentLocationWeather.precipitation_probability[index];
        const temp = this.currentLocationWeather.temperature_2m[index];

        let icon = '🌤️';
        if (rainProb > 70) icon = '🌧️';
        else if (rainProb > 40) icon = '☁️🌧️';
        else if (rainProb > 10) icon = '☁️';

        result.push({
          time: `${hour}:00`,
          icon,
          temp: Math.round(temp),
          rain: rainProb
        });
      }
    }
    return result;
  }

  private scrollToMap(): void {
    setTimeout(() => {
      const mapElement = document.getElementById('map');
      if (mapElement) {
        mapElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Optional: Add a highlight effect
        mapElement.classList.add('ring-4', 'ring-blue-300', 'ring-opacity-50');
        setTimeout(() => {
          mapElement.classList.remove('ring-4', 'ring-blue-300', 'ring-opacity-50');
        }, 1000);
      }
    }, 100);
  }

  onClearCommuterResults(): void {
    this.commuterWeekDays = [];
    this.commuterHomeToWork = { departure: '08:00', arrival: '09:00' };
    this.commuterWorkToHome = { departure: '17:00', arrival: '18:00' };
    this.commuterShowResults = false;
    this.commuterHomeLocation = null;
    this.commuterWorkLocation = null;
    this.showRouteHomeWork = false;
    if (this.mapService.getMap()) {
      this.mapService.clearRoutes();
    }
    if (this.motorcycleCommuter) {
      this.motorcycleCommuter.resetForm();
    }
  }

  onClearMapRoutes(): void {
    if (this.mapService.getMap()) {
      this.showRouteHomeWork = false;
      this.mapService.clearRoutes();
    }
  }
}