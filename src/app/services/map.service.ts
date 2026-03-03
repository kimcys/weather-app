import { Injectable, NgZone } from '@angular/core';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { WeatherForecast } from '../model/forecast.model';
import { WeatherUtils } from '../utils/weather-utils';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map: google.maps.Map | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;
  private markers: google.maps.marker.AdvancedMarkerElement[] = [];
  private markerCluster: MarkerClusterer | null = null;

  constructor(private ngZone: NgZone) { }

  async initializeMap(mapElement: HTMLElement): Promise<boolean> {
    try {
      if (typeof google === 'undefined' || !google.maps) {
        console.error('Google Maps API not loaded');
        return false;
      }

      if (!google.maps.Map || !google.maps.InfoWindow) {
        console.error('Google Maps core components not available');
        return false;
      }

      const useAdvancedMarker = typeof google.maps.marker !== 'undefined' &&
        google.maps.marker &&
        typeof google.maps.marker.AdvancedMarkerElement !== 'undefined';

      const mapOptions: google.maps.MapOptions = {
        center: { lat: 4.2105, lng: 108.975 },
        zoom: 6,
        minZoom: 4,
        maxZoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapId: useAdvancedMarker ? 'DEMO_MAP_ID' : undefined
      };

      this.map = new google.maps.Map(mapElement, mapOptions);
      this.infoWindow = new google.maps.InfoWindow();

      console.log('Map initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing map:', error);
      return false;
    }
  }

  getMap(): google.maps.Map | null {
    return this.map;
  }

  clearMarkers(): void {
    this.markers.forEach(m => m.map = null);
    this.markers = [];
    if (this.markerCluster) {
      this.markerCluster.clearMarkers();
      this.markerCluster = null;
    }
  }

  async addMarkers(
    locations: Array<{ name: string; coords: { lat: number; lng: number }; forecasts: WeatherForecast[] }>,
    onMarkerClick: (forecast: WeatherForecast, allForecasts: WeatherForecast[]) => void
  ): Promise<void> {
    if (!this.map) return;

    this.clearMarkers();

    const advancedMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    const useAdvancedMarker = typeof google.maps.marker !== 'undefined' &&
      google.maps.marker &&
      typeof google.maps.marker.AdvancedMarkerElement !== 'undefined';

    for (const { name, coords, forecasts } of locations) {
      const latestForecast = WeatherUtils.getLatestForecast(forecasts);
      const markerContent = this.createMarkerContent(latestForecast);

      let marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker;

      if (useAdvancedMarker) {
        marker = new google.maps.marker.AdvancedMarkerElement({
          position: coords,
          title: name,
          content: markerContent,
          map: this.map
        });
      } else {
        marker = new google.maps.Marker({
          position: coords,
          title: name,
          map: this.map,
          icon: {
            url: `data:image/svg+xml,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="${markerContent.style.backgroundColor}" stroke="white" stroke-width="2"/>
              <text x="20" y="28" font-size="22" text-anchor="middle" fill="black" font-family="Arial">${markerContent.textContent}</text>
            </svg>
          `)}`,
            scaledSize: new google.maps.Size(40, 40)
          }
        });
      }

      marker.addListener('click', (e: any) => {
        if (e.stopPropagation) {
          e.stopPropagation();
        }

        this.ngZone.run(() => {
          if (this.map) {
            this.map.panTo(coords);
            const currentZoom = this.map.getZoom() || 6;
            if (currentZoom < 8) {
              this.map.setZoom(10);
            }
          }

          onMarkerClick(latestForecast, forecasts);
          this.showInfoWindow(marker, latestForecast, forecasts);
        });
      });

      advancedMarkers.push(marker as google.maps.marker.AdvancedMarkerElement);
      this.markers.push(marker as google.maps.marker.AdvancedMarkerElement);
    }

    if (advancedMarkers.length > 0) {
      try {
        const markerClustererModule = await import('@googlemaps/markerclusterer');
        const MarkerClusterer = markerClustererModule.MarkerClusterer;

        if (MarkerClusterer) {
          this.markerCluster = new MarkerClusterer({
            map: this.map,
            markers: advancedMarkers,
            onClusterClick: (_event, cluster, map) => {
              const bounds = new google.maps.LatLngBounds();

              cluster.markers.forEach((m: any) => {
                // Classic Marker
                if (m instanceof google.maps.Marker) {
                  const p = m.getPosition();
                  if (p) bounds.extend(p);
                  return;
                }
                const p = m?.position;
                if (!p) return;

                if (p instanceof google.maps.LatLng) {
                  bounds.extend(p);
                } else if (typeof p.lat === 'number' && typeof p.lng === 'number') {
                  bounds.extend(p);
                }
              });

              if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
                google.maps.event.addListenerOnce(map, 'idle', () => {
                  const z = map.getZoom() ?? 0;
                  if (z > 14) map.setZoom(14);
                });
              }
            }
          });
          console.log('Marker cluster created with zoom on click');
        }
      } catch (error) {
        console.warn('Error creating marker cluster:', error);
        console.log('Using markers without clustering');
      }
    }
  }

  filterMarkers(visibleLocations: Set<string>, dateForecasts?: Map<string, WeatherForecast>): void {
    this.markers.forEach(marker => {
      const title = marker.title ?? '';

      if (title && visibleLocations.has(title)) {
        marker.map = this.map;

        if (dateForecasts && dateForecasts.has(title)) {
          const forecast = dateForecasts.get(title);
          if (forecast) {
            marker.content = this.createMarkerContent(forecast);
          }
        }
      } else {
        marker.map = null;
      }
    });
  }

  centerOnUserLocation(map: google.maps.Map | null): Promise<google.maps.LatLng | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          map?.setCenter(pos);
          map?.setZoom(10);

          new google.maps.marker.AdvancedMarkerElement({
            position: pos,
            map: map,
            title: 'Lokasi Anda'
          });

          resolve(new google.maps.LatLng(pos.lat, pos.lng));
        },
        () => resolve(null)
      );
    });
  }

  private createMarkerContent(forecast: WeatherForecast): HTMLElement {
    const color = WeatherUtils.getWeatherColor(forecast.summary_forecast);
    const emoji = WeatherUtils.getWeatherEmoji(forecast.summary_forecast);

    const element = document.createElement('div');
    element.style.backgroundColor = color;
    element.style.borderRadius = '50%';
    element.style.border = '2px solid white';
    element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    element.style.width = '40px';
    element.style.height = '40px';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.fontSize = '22px';
    element.style.cursor = 'pointer';
    element.style.transition = 'transform 0.2s, box-shadow 0.2s';
    element.style.fontWeight = 'bold';
    element.textContent = emoji;

    element.addEventListener('mouseenter', () => {
      element.style.transform = 'scale(1.15)';
      element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'scale(1)';
      element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    });

    return element;
  }

  private showInfoWindow(
    marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker,
    latest: WeatherForecast,
    allForecasts: WeatherForecast[]
  ): void {
    if (!this.infoWindow || !this.map) return;

    const content = this.createPopupContent(latest, allForecasts);
    this.infoWindow.setContent(content);

    this.infoWindow.open({
      map: this.map,
      anchor: marker,
      shouldFocus: false
    });
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
            ${WeatherUtils.getWeatherEmoji(f.summary_forecast)}
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
              <span style="font-size: 24px;">${WeatherUtils.getWeatherEmoji(latest.summary_forecast)}</span>
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
                <div>${WeatherUtils.getWeatherEmoji(latest.morning_forecast)}</div>
              </div>
              <div style="background: #fef3c7; padding: 4px; border-radius: 4px;">
                <div>☀️ Petang</div>
                <div>${WeatherUtils.getWeatherEmoji(latest.afternoon_forecast)}</div>
              </div>
              <div style="background: #e0e7ff; padding: 4px; border-radius: 4px;">
                <div>🌙 Malam</div>
                <div>${WeatherUtils.getWeatherEmoji(latest.night_forecast)}</div>
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
}
