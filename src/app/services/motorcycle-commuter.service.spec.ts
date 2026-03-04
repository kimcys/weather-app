import { TestBed } from '@angular/core/testing';

import { MotorcycleCommuterService } from './motorcycle-commuter.service';

describe('MotorcycleCommuterService', () => {
  let service: MotorcycleCommuterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MotorcycleCommuterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
