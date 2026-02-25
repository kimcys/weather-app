import { Component } from '@angular/core';
import { WeatherMapGoogleComponent } from './components/weather-map-google/weather-map-google.component';

@Component({
  selector: 'app-root',
  imports: [WeatherMapGoogleComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'weather-app';
}
