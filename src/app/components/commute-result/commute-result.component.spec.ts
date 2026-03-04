import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommuteResultComponent } from './commute-result.component';

describe('CommuteResultComponent', () => {
  let component: CommuteResultComponent;
  let fixture: ComponentFixture<CommuteResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommuteResultComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommuteResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
