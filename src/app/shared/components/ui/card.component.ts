import { Component, input, computed } from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
  selector: 'app-card',
  template: `
    <div [class]="computedClass()">
      <ng-content></ng-content>
    </div>
  `,
})
export class CardComponent {
  class = input<string>('');

  computedClass = computed(() =>
    cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      this.class()
    )
  );
}

@Component({
  selector: 'app-card-header',
  template: `
    <div [class]="computedClass()">
      <ng-content></ng-content>
    </div>
  `,
})
export class CardHeaderComponent {
  class = input<string>('');

  computedClass = computed(() =>
    cn('flex flex-col space-y-1.5 p-6', this.class())
  );
}

@Component({
  selector: 'app-card-title',
  template: `
    <h3 [class]="computedClass()">
      <ng-content></ng-content>
    </h3>
  `,
})
export class CardTitleComponent {
  class = input<string>('');

  computedClass = computed(() =>
    cn('text-2xl font-semibold leading-none tracking-tight', this.class())
  );
}

@Component({
  selector: 'app-card-content',
  template: `
    <div [class]="computedClass()">
      <ng-content></ng-content>
    </div>
  `,
})
export class CardContentComponent {
  class = input<string>('');

  computedClass = computed(() => cn('p-6 pt-0', this.class()));
}
