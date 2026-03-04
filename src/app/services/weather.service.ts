// services/weather.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WeatherForecast } from '../model/forecast.model';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl = 'https://api.data.gov.my/weather';

  constructor(private http: HttpClient) {}

  getForecast(): Observable<WeatherForecast[]> {
    return this.http.get<WeatherForecast[]>(`${this.apiUrl}/forecast`);
  }
}