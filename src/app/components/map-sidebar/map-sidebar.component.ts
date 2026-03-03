import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WeatherForecast } from '../../model/forecast.model';
import { WeatherUtils } from '../../utils/weather-utils';

@Component({
  selector: 'app-map-sidebar',
  imports: [CommonModule, FormsModule],
  templateUrl: './map-sidebar.component.html',
  styleUrl: './map-sidebar.component.css'
})
export class MapSidebarComponent {

  @Input() selectedForecast : WeatherForecast | null = null;
  @Input() uniqueDates: string[] = [];
  @Input() locations: string[] = [];
  @Input() forecasts: WeatherForecast[] = [];
  @Input() filteredDate: string = '';
  @Input() selectedLocationType: string = 'St';
  @Input() locationTypes = [
    { value: 'St', label: 'Negeri' },
    { value: 'Rc', label: 'Pusat Rekreasi' },
    { value: 'Ds', label: 'Daerah' },
    { value: 'Tn', label: 'Bandar' },
    { value: 'Dv', label: 'Bahagian' }
  ];

  @Output() onDateFilter = new EventEmitter<string>();
  @Output() onLocationTypeFilter = new EventEmitter<string>();
  @Output() onResetFilter = new EventEmitter<void>();
  @Output() onLocationSelect = new EventEmitter<string>();

  getWeatherEmoji = WeatherUtils.getWeatherEmoji;

  getForecastsForLocation(location: string): WeatherForecast[] {
    return this.forecasts.filter(f => f.location.location_name === location);
  }

  getLatestForecastEmoji(location: string): string {
    const forecasts = this.getForecastsForLocation(location);
    if (forecasts.length === 0) return '☀️';
    const latest = WeatherUtils.getLatestForecast(forecasts);
    return WeatherUtils.getWeatherEmoji(latest.summary_forecast);
  }

  getLatestForecastSummary(location: string): string {
    const forecasts = this.getForecastsForLocation(location);
    if (forecasts.length === 0) return '';
    const latest = WeatherUtils.getLatestForecast(forecasts);
    return latest.summary_forecast;
  }

  getLatestForecastTemp(location: string): string {
    const forecasts = this.getForecastsForLocation(location);
    if (forecasts.length === 0) return '';
    const latest = WeatherUtils.getLatestForecast(forecasts);
    return `${latest.min_temp}° - ${latest.max_temp}°`;
  }
}
