import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeatherMapGoogleComponent } from './weather-map-google.component';

describe('WeatherMapGoogleComponent', () => {
  let component: WeatherMapGoogleComponent;
  let fixture: ComponentFixture<WeatherMapGoogleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherMapGoogleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeatherMapGoogleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
