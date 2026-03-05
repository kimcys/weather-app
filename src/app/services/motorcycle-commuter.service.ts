import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HourlyWeather, WeatherApiResponse } from '../model/motorcycle.model';
import { catchError, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MotorcycleCommuterService {

  constructor(private http: HttpClient) { }

  getHourlyForecast(lat: number, lng: number): Observable<HourlyWeather> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation_probability,precipitation,rain,temperature_2m,apparent_temperature,windspeed_10m,windgusts_10m,visibility,weathercode&timezone=Asia/Kuala_Lumpur&forecast_days=7`;
    return this.http.get<WeatherApiResponse>(url).pipe(
      map(response => {
        return response.hourly;
      }),
      catchError(error => {
        console.error('API Error:', error);
        return throwError(() => new Error('Failed to fetch forecast'));
      })
    );
  }

}
