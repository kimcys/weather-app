import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotorcycleCommuterComponent } from './motorcycle-commuter.component';

describe('MotorcycleCommuterComponent', () => {
  let component: MotorcycleCommuterComponent;
  let fixture: ComponentFixture<MotorcycleCommuterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotorcycleCommuterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MotorcycleCommuterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
