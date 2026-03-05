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
  OnInit,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
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
  private readonly SCROLL_SPEED = 1.5; // Slightly slower for smoother scroll
  private isAutoScrolling = true;
  private userInteracted = false;
  private interactionTimeout: any;
  private readonly INTERACTION_TIMEOUT = 2000; // Longer timeout on mobile
  private isMobile = false;
  private isBrowser = false;
  private scrollAnimationFrame: any;
  private lastScrollPosition = 0;
  private isTouching = false;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.updateOtherLocations();
    this.checkMobile();
    
    if (this.isBrowser) {
      window.addEventListener('resize', this.checkMobile.bind(this));
    }
  }

  ngAfterViewInit() {
    if (!this.isBrowser) return;
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      this.checkScrollButtons();
      this.startAutoScroll();
    }, 100);
    
    // Add event listeners for user interaction
    const container = this.scrollContainer?.nativeElement;
    if (container) {
      // Mouse events (desktop)
      container.addEventListener('wheel', () => this.handleUserInteraction(), { passive: true });
      container.addEventListener('mousedown', () => this.handleUserInteraction());
      container.addEventListener('mouseenter', () => this.handleUserInteraction());
      
      // Touch events (mobile)
      container.addEventListener('touchstart', () => this.handleTouchStart(), { passive: true });
      container.addEventListener('touchmove', () => this.handleTouchMove(), { passive: true });
      container.addEventListener('touchend', () => this.handleTouchEnd());
      container.addEventListener('touchcancel', () => this.handleTouchEnd());
      
      // Scroll event
      container.addEventListener('scroll', () => this.onScroll(), { passive: true });
    }
  }

  ngOnDestroy() {
    this.stopAutoScroll();
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
    }
    
    if (this.isBrowser) {
      window.removeEventListener('resize', this.checkMobile.bind(this));
    }
  }

  private checkMobile(): void {
    if (!this.isBrowser) return;
    this.isMobile = window.innerWidth < 768; // Match md breakpoint
  }

  private handleTouchStart(): void {
    this.isTouching = true;
    this.handleUserInteraction();
  }

  private handleTouchMove(): void {
    this.isTouching = true;
    this.handleUserInteraction();
  }

  private handleTouchEnd(): void {
    this.isTouching = false;
    // Don't immediately resume auto-scroll, wait for timeout
  }

  private handleUserInteraction() {
    if (this.isMobile) return; // Don't do anything on mobile
    
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
    if (!this.scrollContainer) return;
    this.handleUserInteraction();
    
    const container = this.scrollContainer.nativeElement;
    const cardWidth = this.getCardWidth();
    
    container.scrollBy({
      left: -cardWidth,
      behavior: 'smooth'
    });
    
    setTimeout(() => this.checkScrollButtons(), 300);
  }

  scrollRight() {
    if (!this.scrollContainer) return;
    this.handleUserInteraction();
    
    const container = this.scrollContainer.nativeElement;
    const cardWidth = this.getCardWidth();
    
    container.scrollBy({
      left: cardWidth,
      behavior: 'smooth'
    });
    
    setTimeout(() => this.checkScrollButtons(), 300);
  }

  private getCardWidth(): number {
    if (!this.isBrowser) return 200;
    
    // Different card widths based on screen size
    if (window.innerWidth < 640) return 176; // w-44 = 176px
    if (window.innerWidth < 768) return 192; // sm:w-48 = 192px
    return 224; // md:w-56 = 224px
  }

  onScroll() {
    if (!this.scrollContainer) return;
    
    const container = this.scrollContainer.nativeElement;
    const currentScroll = container.scrollLeft;
    
    // Only trigger if scroll position actually changed (debounce)
    if (Math.abs(currentScroll - this.lastScrollPosition) > 5) {
      this.lastScrollPosition = currentScroll;
      this.checkScrollButtons();
      this.handleInfiniteLoop();
      
      // On mobile, user is interacting
      if (this.isMobile && this.isTouching) {
        this.handleUserInteraction();
      }
    }
  }

  private checkScrollButtons() {
    if (!this.scrollContainer) return;
    
    const container = this.scrollContainer.nativeElement;
    const tolerance = 5;
    
    this.canScrollLeft = container.scrollLeft > tolerance;
    this.canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - tolerance;
  }

  private handleInfiniteLoop() {
    if (!this.scrollContainer) return;
    
    const container = this.scrollContainer.nativeElement;
    const halfScrollWidth = container.scrollWidth / 2;

    // If scrolled past the first set, jump back to the beginning
    if (container.scrollLeft >= halfScrollWidth && halfScrollWidth > 0) {
      container.scrollLeft = 0;
      this.lastScrollPosition = 0;
    }
    // If scrolled before the first set, jump to the second set
    else if (container.scrollLeft < 0) {
      container.scrollLeft = halfScrollWidth - container.clientWidth;
      this.lastScrollPosition = container.scrollLeft;
    }
  }

  // Auto-scroll methods
  private startAutoScroll() {
    if (!this.isBrowser || !this.scrollContainer) return;
    
    // Don't auto-scroll on mobile
    if (this.isMobile) {
      console.log('Auto-scroll disabled on mobile');
      return;
    }
    
    this.ngZone.runOutsideAngular(() => {
      const scrollStep = () => {
        if (!this.scrollContainer) return;
        
        this.scrollAnimationFrame = requestAnimationFrame(() => {
          this.ngZone.run(() => {
            // Only auto-scroll if conditions are met
            if (this.scrollContainer && 
                !this.userInteracted && 
                this.isAutoScrolling && 
                this.canScrollRight && 
                !this.isMobile) {
              
              const container = this.scrollContainer.nativeElement;
              const maxScroll = container.scrollWidth - container.clientWidth;
              
              if (container.scrollLeft >= maxScroll - 20) {
                // Instantly jump to start for infinite effect
                container.scrollLeft = 0;
                this.lastScrollPosition = 0;
              } else {
                // Increment scroll position
                container.scrollLeft += this.SCROLL_SPEED;
                this.lastScrollPosition = container.scrollLeft;
              }
              
              this.checkScrollButtons();
            }
          });
          
          // Continue the animation loop
          if (!this.isMobile) {
            scrollStep();
          }
        });
      };
      
      // Start the animation loop
      scrollStep();
    });
  }

  private stopAutoScroll() {
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
      this.scrollAnimationFrame = null;
    }
  }

  // Public methods
  pauseAutoScroll() {
    if (this.isMobile) return;
    this.userInteracted = true;
    this.isAutoScrolling = false;
  }

  resumeAutoScroll() {
    if (this.isMobile) return;
    this.userInteracted = false;
    this.isAutoScrolling = true;
  }
}