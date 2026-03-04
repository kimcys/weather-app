import { 
  Component, 
  Input, 
  Output, 
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherForecast } from '../../model/forecast.model';
import { WeatherUtils } from '../../utils/weather-utils';

@Component({
  selector: 'app-weather-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weather-cards.component.html',
  styleUrls: ['./weather-cards.component.css']
})
export class WeatherCardsComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  @Input() selectedForecast: WeatherForecast | null = null;
  @Input() uniqueDates: string[] = [];
  @Input() locations: string[] = [];
  @Input() forecasts: WeatherForecast[] = [];
  @Input() filteredDate: string = '';
  @Input() selectedLocationType: string = 'Ds';
  @Input() locationTypes = [
    { value: 'Ds', label: 'Daerah' },
  ];

  @Output() onDateFilter = new EventEmitter<string>();
  @Output() onLocationTypeFilter = new EventEmitter<string>();
  @Output() onResetFilter = new EventEmitter<void>();
  @Output() onLocationSelect = new EventEmitter<string>();

  canScrollLeft = false;
  canScrollRight = true;
  otherLocations: string[] = [];

  private scrollInterval: any;
  private readonly SCROLL_SPEED = 2.0;
  private isAutoScrolling = true;
  private userInteracted = false;
  private interactionTimeout: any;
  private readonly INTERACTION_TIMEOUT = 1000;


  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.updateOtherLocations();
  }

  ngAfterViewInit() {
    this.startAutoScroll();
    this.checkScrollButtons();
    
    // Add event listeners for user interaction
    const container = this.scrollContainer.nativeElement;
    container.addEventListener('wheel', () => this.handleUserInteraction());
    container.addEventListener('touchstart', () => this.handleUserInteraction());
    container.addEventListener('mousedown', () => this.handleUserInteraction());
  }

  ngOnDestroy() {
    this.stopAutoScroll();
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }
  }

  private handleUserInteraction() {
    this.userInteracted = true;
    this.isAutoScrolling = false;
    
    // Clear any existing timeout
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }
    
    // Set timeout to resume auto-scroll after user stops interacting
    this.interactionTimeout = setTimeout(() => {
      this.userInteracted = false;
      this.isAutoScrolling = true;
    }, this.INTERACTION_TIMEOUT);
  }

  private updateOtherLocations() {
    if (this.selectedForecast) {
      this.otherLocations = this.locations.filter(
        loc => loc !== this.selectedForecast?.location?.location_name
      );
    } else {
      this.otherLocations = [...this.locations];
    }
  }

  // Get locations excluding the selected one
  getOtherLocations(): string[] {
    if (this.selectedForecast) {
      return this.locations.filter(
        loc => loc !== this.selectedForecast?.location?.location_name
      );
    }
    return this.locations;
  }

  // Utility methods
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

  isSelectedLocation(location: string): boolean {
    return this.selectedForecast?.location?.location_name === location;
  }

  trackByLocation(index: number, location: string): string {
    return location;
  }

  scrollLeft() {
    this.handleUserInteraction(); // Pause auto-scroll
    
    const container = this.scrollContainer.nativeElement;
    const cardWidth = 240; 
    
    // Use scrollBy with smooth behavior
    container.scrollBy({
      left: -cardWidth,
      behavior: 'smooth'
    });
    
    // Update button states after animation
    setTimeout(() => this.checkScrollButtons(), 300);
  }

  scrollRight() {
    this.handleUserInteraction(); // Pause auto-scroll
    
    const container = this.scrollContainer.nativeElement;
    const cardWidth = 240; // 224px width + 16px gap
    
    container.scrollBy({
      left: cardWidth,
      behavior: 'smooth'
    });
    
    setTimeout(() => this.checkScrollButtons(), 300);
  }

  onScroll() {
    this.checkScrollButtons();
    this.handleInfiniteLoop();
  }

  private checkScrollButtons() {
    if (this.scrollContainer) {
      const container = this.scrollContainer.nativeElement;
      const tolerance = 5; // Small tolerance for rounding errors
      
      this.canScrollLeft = container.scrollLeft > tolerance;
      this.canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - tolerance;
    }
  }

  private handleInfiniteLoop() {
    const container = this.scrollContainer.nativeElement;
    const halfScrollWidth = container.scrollWidth / 2;

    // If scrolled past the first set, jump back to the beginning
    if (container.scrollLeft >= halfScrollWidth && halfScrollWidth > 0) {
      container.scrollLeft = 0;
    }
    // If scrolled before the first set, jump to the second set
    else if (container.scrollLeft < 0) {
      container.scrollLeft = halfScrollWidth - container.clientWidth;
    }
  }

  // Auto-scroll methods
  private startAutoScroll() {
    this.ngZone.runOutsideAngular(() => {
      this.scrollInterval = setInterval(() => {
        this.ngZone.run(() => {
          // Only auto-scroll if user hasn't interacted recently
          if (this.scrollContainer && !this.userInteracted && this.isAutoScrolling && this.canScrollRight) {
            const container = this.scrollContainer.nativeElement;
            const maxScroll = container.scrollWidth - container.clientWidth;
            
            if (container.scrollLeft >= maxScroll - 10) {
              // Instantly jump to start for infinite effect (no smooth)
              container.scrollLeft = 0;
            } else {
              // Use requestAnimationFrame for smoother animation
              requestAnimationFrame(() => {
                container.scrollLeft += this.SCROLL_SPEED;
              });
            }
            this.checkScrollButtons();
          }
        });
      }, 16); // ~60fps (16ms per frame)
    });
  }

  private stopAutoScroll() {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
    }
  }

  // Public method to manually pause auto-scroll (can be called from template)
  pauseAutoScroll() {
    this.userInteracted = true;
    this.isAutoScrolling = false;
  }

  resumeAutoScroll() {
    this.userInteracted = false;
    this.isAutoScrolling = true;
  }
}