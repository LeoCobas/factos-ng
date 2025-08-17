import { Component, input, computed, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';

@Component({
  selector: 'app-input',
  template: `
    <input
      [class]="computedClass()"
      [type]="type()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [value]="value"
      (input)="onInput($event)"
      (blur)="onTouched()"
    />
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  type = input<string>('text');
  placeholder = input<string>('');
  disabled = input<boolean>(false);
  class = input<string>('');

  value = '';
  onChange = (value: string) => {};
  onTouched = () => {};

  computedClass = computed(() =>
    cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      this.class()
    )
  );

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // El estado disabled se maneja a través del input signal
  }
}
