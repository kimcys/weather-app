// services/weather.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { WeatherForecast } from '../model/forecast.model';

export interface WeatherWarning {
  // Define based on API response
  [key: string]: any;
}

export interface EarthquakeWarning {
  // Define based on API response
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl = 'https://api.data.gov.my/weather';

  constructor(private http: HttpClient) {}

  getForecast(): Observable<WeatherForecast[]> {
    return this.http.get<WeatherForecast[]>(`${this.apiUrl}/forecast`);
  }

  getWarnings(): Observable<WeatherWarning[]> {
    return this.http.get<WeatherWarning[]>(`${this.apiUrl}/warning`);
  }

  getEarthquakeWarnings(): Observable<EarthquakeWarning[]> {
    return this.http.get<EarthquakeWarning[]>(`${this.apiUrl}/warning/earthquake`);
  }

  getAllWeatherData(): Observable<any> {
    return forkJoin({
      forecast: this.getForecast(),
      warnings: this.getWarnings(),
      earthquakes: this.getEarthquakeWarnings()
    });
  }
}