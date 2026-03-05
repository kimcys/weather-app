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
  private directionsRenderers: google.maps.DirectionsRenderer[] = [];
  private markerByTitle = new Map<string, google.maps.marker.AdvancedMarkerElement | google.maps.Marker>();
  private forecastByTitle = new Map<string, { latest: WeatherForecast; all: WeatherForecast[]; coords: { lat: number; lng: number } }>();
  private payloadByTitle = new Map<string, { coords: { lat: number; lng: number }; latest: WeatherForecast; all: WeatherForecast[] }>();

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
    const useAdvancedMarker =
      typeof google.maps.marker !== 'undefined' &&
      google.maps.marker &&
      typeof google.maps.marker.AdvancedMarkerElement !== 'undefined';

    for (const { name, coords, forecasts } of locations) {
      const latestForecast = WeatherUtils.getLatestForecast(forecasts);
      const markerContent = this.createMarkerContent(latestForecast);

      let marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker;

      // --- create marker ---
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
          map: this.map
        });
      }

      // --- store lookup so cards can focus by name later ---
      const key = this.normKey(name);
      this.markerByTitle.set(key, marker);
      this.payloadByTitle.set(key, { coords, latest: latestForecast, all: forecasts });

      // --- click handler ---
      marker.addListener('click', (e: any) => {
        if (e?.stopPropagation) e.stopPropagation();
      
        this.ngZone.run(() => {
          if (!this.map) return;
      
          const center = this.getMarkerLatLng(marker, coords);
          if (center) this.map.setCenter(center);
          const z = this.map.getZoom() ?? 6;
          if (z < 7) this.map.setZoom(8);
      
          onMarkerClick(latestForecast, forecasts);
          this.showInfoWindow(marker, latestForecast, forecasts);
        });
      });

      // --- keep a list for filtering/hiding ---
      this.markers.push(marker as google.maps.marker.AdvancedMarkerElement);

      if (useAdvancedMarker) {
        advancedMarkers.push(marker as google.maps.marker.AdvancedMarkerElement);
      }
    }

    // --- clustering (only if we have advanced markers list) ---
    if (advancedMarkers.length > 0) {
      try {
        const markerClustererModule = await import('@googlemaps/markerclusterer');
        const MarkerClusterer = markerClustererModule.MarkerClusterer;

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

              // Advanced marker: m.position can be LatLng or {lat,lng}
              const p = m?.position;
              if (!p) return;

              if (p instanceof google.maps.LatLng) bounds.extend(p);
              else if (typeof p.lat === 'number' && typeof p.lng === 'number') bounds.extend(p);
            });

            if (bounds.isEmpty()) return;

            map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
            google.maps.event.addListenerOnce(map, 'idle', () => {
              const z = map.getZoom() ?? 0;
              const center = bounds.getCenter();
              map.panTo(center);

              const maxAllowed = 14;
              if (z > maxAllowed) this.smoothZoom(map, maxAllowed, 60);
            });
          }
        });
      } catch (error) {
        console.warn('Error creating marker cluster:', error);
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
    const bg = WeatherUtils.getWeatherColor(forecast.summary_forecast);
    const emoji = WeatherUtils.getWeatherEmoji(forecast.summary_forecast);
    const isDark = this.isDarkColor(bg);

    const el = document.createElement('div');
    el.style.backgroundColor = bg;
    el.style.borderRadius = '50%';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '22px';
    el.style.cursor = 'pointer';
    el.style.transition = 'transform 0.2s, box-shadow 0.2s';
    el.style.userSelect = 'none';

    el.style.border = isDark ? '2px solid rgba(255,255,255,0.9)' : '2px solid white';
    el.style.boxShadow = isDark
      ? '0 4px 12px rgba(0,0,0,0.55)'
      : '0 2px 8px rgba(0,0,0,0.35)';

    el.textContent = emoji;

    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.15)';
      el.style.boxShadow = isDark
        ? '0 6px 16px rgba(0,0,0,0.65)'
        : '0 5px 14px rgba(0,0,0,0.45)';
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
      el.style.boxShadow = isDark
        ? '0 4px 12px rgba(0,0,0,0.55)'
        : '0 2px 8px rgba(0,0,0,0.35)';
    });

    return el;
  }

  private isDarkColor(hex: string): boolean {
    const h = (hex || '').replace('#', '');
    if (h.length !== 6) return false;

    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.45;
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

  private smoothZoom(map: google.maps.Map, targetZoom: number, stepDelay = 80): void {
    const startZoom = map.getZoom() ?? 6;

    if (startZoom === targetZoom) return;

    const direction = targetZoom > startZoom ? 1 : -1;
    let current = startZoom;

    const tick = () => {
      current += direction;
      map.setZoom(current);

      if (current !== targetZoom) {
        window.setTimeout(tick, stepDelay);
      }
    };

    window.setTimeout(tick, stepDelay);
  }

  private createPopupContent(latest: WeatherForecast, allForecasts: WeatherForecast[]): string {
    const sorted = [...allForecasts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' });
  
    const pill = (label: string, emoji: string) => `
      <div class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-center">
        <div class="text-[10px] font-medium text-gray-500">${label}</div>
        <div class="mt-0.5 text-sm leading-none">${emoji}</div>
      </div>
    `;
  
    const forecastItems = sorted.slice(0, 5).map(f => {
      const active = f.date === latest.date;
  
      return `
        <div class="flex items-start justify-between gap-3 rounded-lg px-2 py-2
                    ${active ? 'bg-gray-50 ring-1 ring-gray-200' : 'hover:bg-gray-50'}">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-gray-900">${fmt(f.date)}</span>
              ${active ? `<span class="text-[10px] font-semibold text-gray-500">Terkini</span>` : ``}
            </div>
            <div class="mt-0.5 truncate text-[11px] text-gray-600">
              ${f.summary_forecast} <span class="text-gray-400">•</span> ${f.summary_when}
            </div>
          </div>
  
          <div class="flex shrink-0 items-center gap-2 text-xs text-gray-700">
            <span class="text-sm leading-none">${WeatherUtils.getWeatherEmoji(f.summary_forecast)}</span>
            <span class="font-medium">${f.min_temp}°/${f.max_temp}°</span>
          </div>
        </div>
      `;
    }).join('');
  
    return `
      <div class="w-[290px] font-sans">
        <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <!-- Header -->
          <div class="px-4 pt-4 pb-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-semibold text-gray-900">
                  ${latest.location.location_name}
                </h3>
  
                <div class="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>${fmt(latest.date)}</span>
                  <span class="text-gray-300">•</span>
                  <span>${latest.summary_when}</span>
                </div>
              </div>
  
              <div class="shrink-0 text-lg leading-none">
                ${WeatherUtils.getWeatherEmoji(latest.summary_forecast)}
              </div>
            </div>
  
            <!-- Summary (minimal) -->
            <div class="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-xs font-semibold text-gray-900">
                    ${latest.summary_forecast}
                  </div>
                  <div class="mt-0.5 text-[11px] text-gray-600">
                    🌡️ ${latest.min_temp}°C – ${latest.max_temp}°C
                  </div>
                </div>
  
                <div class="shrink-0 text-right text-[11px] text-gray-500">
                  ⏰ ${latest.summary_when}
                </div>
              </div>
            </div>
  
            <!-- Day parts -->
            <div class="mt-3 grid grid-cols-3 gap-2">
              ${pill('Pagi', WeatherUtils.getWeatherEmoji(latest.morning_forecast))}
              ${pill('Petang', WeatherUtils.getWeatherEmoji(latest.afternoon_forecast))}
              ${pill('Malam', WeatherUtils.getWeatherEmoji(latest.night_forecast))}
            </div>
          </div>
  
          <!-- 5-day list -->
          <div class="border-t border-gray-200 px-4 py-3">
            <div class="mb-2 text-[11px] font-semibold tracking-wide text-gray-500">
              5-Hari Ramalan
            </div>
  
            <div class="max-h-[160px] space-y-1 overflow-y-auto pr-1">
              ${forecastItems}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  showRoute(
    start: { lat: number, lng: number },
    end: { lat: number, lng: number },
    label: string,
    color: string = '#3B82F6'
  ) {
    const map = this.getMap();
    if (!map) return;

    // Create directions service and renderer
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: color,
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });

    // Store renderer to clear later
    this.directionsRenderers.push(directionsRenderer);

    // Calculate route
    directionsService.route({
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING
    }, (response, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(response);
      }
    });
  }

  private normKey(name: string): string {
    return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  focusLocation(locationName: string): boolean {
    if (!this.map) return false;

    const key = this.normKey(locationName);
    const marker = this.markerByTitle.get(key);
    const payload = this.payloadByTitle.get(key);
    if (!payload) return false;

    // 1) Pan + zoom
    this.map.panTo(payload.coords);
    const currentZoom = this.map.getZoom() ?? 6;
    const targetZoom = Math.min(currentZoom + 1, 8);
    
    if (targetZoom > currentZoom) {
      this.smoothZoom(this.map!, targetZoom, 70);
    }

    // 2) Open same info window as marker click
    if (marker) {
      this.showInfoWindow(marker as any, payload.latest, payload.all);
    }

    return true;
  }

  private getMarkerLatLng(
    marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker,
    fallback?: { lat: number; lng: number }
  ): google.maps.LatLngLiteral | null {
    // Classic marker
    if (marker instanceof google.maps.Marker) {
      const p = marker.getPosition();
      if (!p) return fallback ?? null;
      return { lat: p.lat(), lng: p.lng() };
    }
  
    // Advanced marker
    const p: any = (marker as any).position;
    if (!p) return fallback ?? null;
  
    // LatLng
    if (p instanceof google.maps.LatLng) return { lat: p.lat(), lng: p.lng() };
  
    // LatLngLiteral
    if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
  
    return fallback ?? null;
  }

  clearRoutes() {
    this.directionsRenderers.forEach(renderer => renderer.setMap(null));
    this.directionsRenderers = [];
  }
}
