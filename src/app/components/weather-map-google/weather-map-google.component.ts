import { Component, ViewChild, NgZone } from '@angular/core';
import { WeatherForecast } from '../../model/forecast.model';
import { WeatherService } from '../../services/weather.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-weather-map-google',
  imports: [CommonModule, FormsModule],
  templateUrl: './weather-map-google.component.html',
  styleUrl: './weather-map-google.component.css'
})
export class WeatherMapGoogleComponent {
  @ViewChild('mapContainer') mapContainer: any;

  private map: google.maps.Map | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;
  private markers: google.maps.marker.AdvancedMarkerElement[] = [];
  private apiLoaded = false;

  private malaysiaBounds = {
    north: 7.5,
    south: 1.0,
    west: 99.5,
    east: 119.5
  };

  forecasts: WeatherForecast[] = [];
  selectedForecast: WeatherForecast | null = null;
  filteredDate: string = '';
  uniqueDates: string[] = [];
  todayLabel = '';
  mapError = false;

  constructor(
    private weatherService: WeatherService,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.todayLabel = new Date().toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    this.loadWeatherData();
    this.checkGoogleMapsLoaded();
  }

  ngAfterViewInit(): void {
    if (this.apiLoaded) {
      this.initMap();
    }
  }

  private checkGoogleMapsLoaded(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.apiLoaded = true;
      this.initMap();
    } else {
      window.addEventListener('load', () => {
        if (typeof google !== 'undefined' && google.maps) {
          this.ngZone.run(() => {
            this.apiLoaded = true;
            this.initMap();
          });
        }
      });
    }
  }

  private initMap(): void {
    try {
      const mapElement = document.getElementById('map');
      if (!mapElement) {
        console.error('Map element not found');
        this.mapError = true;
        return;
      }

      const mapOptions: google.maps.MapOptions = {
        center: { lat: 4.2105, lng: 108.975 },
        zoom: 6,
        restriction: {
          latLngBounds: this.malaysiaBounds,
          strictBounds: false
        },
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapId: 'DEMO_MAP_ID'
      };

      this.map = new google.maps.Map(mapElement, mapOptions);
      this.infoWindow = new google.maps.InfoWindow();
      
      console.log('Map initialized successfully with mapId');
      
      if (this.forecasts.length > 0) {
        this.addMarkersToMap();
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      this.mapError = true;
    }
  }

  private loadWeatherData(): void {
    this.weatherService.getForecast().subscribe({
      next: (data) => {
        this.forecasts = data;
        this.uniqueDates = [...new Set(data.map(f => f.date))].sort();
        if (this.map) {
          this.addMarkersToMap();
        }
      },
      error: (error) => {
        console.error('Error loading weather data:', error);
      }
    });
  }

  private addMarkersToMap(): void {
    if (!this.map) return;
  
    this.markers.forEach(m => m.map = null);
    this.markers = [];
  
    const locationGroups = this.groupForecastsByLocation();
  
    Object.entries(locationGroups).forEach(([locationName, forecasts]) => {
  
      const sample = forecasts[0];
  
      const lat = Number(sample.location.latitude);
      const lng = Number(sample.location.longitude);
  
      if (!lat || !lng) return;
  
      const position = { lat, lng };
  
      const latestForecast = forecasts
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
      const markerContent = this.createMarkerContent(latestForecast);
  
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position,
        map: this.map!,
        title: locationName,
        content: markerContent
      });
  
      marker.addListener('click', () => {
        this.ngZone.run(() => {
          this.selectedForecast = latestForecast;
          this.showInfoWindow(marker, latestForecast, forecasts);
        });
      });
  
      this.markers.push(marker);
    });
  }

  private createMarkerContent(forecast: WeatherForecast): HTMLElement {
    const text = (forecast.summary_forecast ?? '').trim().toLowerCase();
  
    const isNoRain = text.includes('tiada hujan') || text.includes('tanpa hujan');
    const isStorm  = text.includes('ribut');
    const isRain   = !isNoRain && text.includes('hujan'); 
    let color = '#10b981';
    let emoji = '☀️';
  
    if (isStorm) {
      color = '#ef4444';
      emoji = '⛈️';
    } else if (isRain) {
      color = '#3b82f6';
      emoji = '🌧️';
    } else if (isNoRain || text.includes('cerah')) {
      color = '#f59e0b';
      emoji = '☀️';
    } else if (text.includes('mendung')) {
      color = '#6b7280';
      emoji = '☁️';
    }
  
    const element = document.createElement('div');
    element.style.backgroundColor = color;
    element.style.borderRadius = '50%';
    element.style.border = '2px solid white';
    element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    element.style.width = '36px';
    element.style.height = '36px';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.fontSize = '20px';
    element.style.cursor = 'pointer';
    element.style.transition = 'transform 0.2s';
    element.textContent = emoji;
  
    element.addEventListener('mouseenter', () => (element.style.transform = 'scale(1.1)'));
    element.addEventListener('mouseleave', () => (element.style.transform = 'scale(1)'));
  
    return element;
  }

  private createPopupContent(latest: WeatherForecast, allForecasts: WeatherForecast[]): string {
    const sortedForecasts = [...allForecasts].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const forecastItems = sortedForecasts.slice(0, 5).map(f => `
      <div class="popup-forecast-item ${f.date === latest.date ? 'popup-latest' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: ${f.date === latest.date ? 'bold' : 'normal'};">
            ${new Date(f.date).toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <span style="display: flex; align-items: center; gap: 4px;">
            ${this.getWeatherEmoji(f.summary_forecast)}
            <span>${f.min_temp}°/${f.max_temp}°</span>
          </span>
        </div>
        <div style="font-size: 11px; color: #666; margin-top: 2px;">
          ${f.summary_forecast} (${f.summary_when})
        </div>
      </div>
    `).join('');

    return `
      <div class="google-popup">
        <div style="padding: 12px;">
          <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">
            ${latest.location.location_name}
          </h3>
          
          <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 24px;">${this.getWeatherEmoji(latest.summary_forecast)}</span>
              <span style="font-weight: bold; font-size: 16px;">${latest.summary_forecast}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span>🌡️ ${latest.min_temp}°C - ${latest.max_temp}°C</span>
              <span>⏰ ${latest.summary_when}</span>
            </div>
          </div>

          <div style="margin: 8px 0;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; text-align: center; font-size: 12px;">
              <div style="background: #dbeafe; padding: 4px; border-radius: 4px;">
                <div>🌅 Pagi</div>
                <div>${this.getWeatherEmoji(latest.morning_forecast)}</div>
              </div>
              <div style="background: #fef3c7; padding: 4px; border-radius: 4px;">
                <div>☀️ Petang</div>
                <div>${this.getWeatherEmoji(latest.afternoon_forecast)}</div>
              </div>
              <div style="background: #e0e7ff; padding: 4px; border-radius: 4px;">
                <div>🌙 Malam</div>
                <div>${this.getWeatherEmoji(latest.night_forecast)}</div>
              </div>
            </div>
          </div>

          <div style="margin-top: 12px;">
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">5-Hari Ramalan:</div>
            <div style="max-height: 150px; overflow-y: auto;">
              ${forecastItems}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getWeatherEmoji(forecast?: string | null): string {
    const text = (forecast ?? '').trim().toLowerCase();
  
    if (text.includes('tiada hujan') || text.includes('tanpa hujan')) return '☀️';
  
    if (text.includes('ribut')) return '⛈️';
    if (text.includes('hujan')) return '🌧️';
    if (text.includes('cerah')) return '☀️';
    if (text.includes('mendung')) return '☁️';
  
    return '☀️';
  }

  private groupForecastsByLocation(): { [key: string]: WeatherForecast[] } {
    return this.forecasts.reduce((groups, forecast) => {
      const location = forecast.location.location_name;
      if (!groups[location]) {
        groups[location] = [];
      }
      groups[location].push(forecast);
      return groups;
    }, {} as { [key: string]: WeatherForecast[] });
  }

  filterByDate(date: string): void {
    this.filteredDate = date;
    if (!this.map) return;

    if (!date) {
      this.markers.forEach(m => m.map = this.map);
      return;
    }
    
    const dateForecasts = this.forecasts.filter(f => f.date === date);
    const locationsWithData = new Set(dateForecasts.map(f => f.location.location_name));
    
    this.markers.forEach(m => {
      const title = m.title ?? '';
      if (title && locationsWithData.has(title)) {
        m.map = this.map;

        const forecast = dateForecasts.find(f => f.location.location_name === title);
        if (forecast) {
          m.content = this.createMarkerContent(forecast);
        }
      } else {
        m.map = null;
      }
    });
  }

  resetFilter(): void {
    this.filteredDate = '';
    if (!this.map) return;

    this.markers.forEach(m => {
      m.map = this.map;

      const title = m.title ?? '';
      if (!title) return;

      const latest = this.forecasts
        .filter(f => f.location.location_name === title)
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (latest) {
        m.content = this.createMarkerContent(latest);
      }
    });
  }

  private showInfoWindow(
    marker: google.maps.marker.AdvancedMarkerElement,
    latest: WeatherForecast,
    allForecasts: WeatherForecast[]
  ): void {
    if (!this.infoWindow || !this.map) return;

    const content = this.createPopupContent(latest, allForecasts);
    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);
  }

  getLocationsWithForecast(): string[] {
    return Object.keys(this.groupForecastsByLocation());
  }

  getForecastForLocation(location: string): WeatherForecast[] {
    return this.forecasts
      .filter(f => f.location.location_name === location)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  retryLoadMap(): void {
    this.mapError = false;
    this.checkGoogleMapsLoaded();
  }
}