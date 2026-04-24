import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

/**
 * Slider wrapper around Radix UI.
 *
 * Radix requires one <Thumb /> per value in the `value` (or `defaultValue`)
 * array. We therefore render N thumbs dynamically based on the incoming
 * array length, falling back to a single thumb when no value is provided.
 * This fixes the long-standing bug where range sliders rendered only the
 * first (min) handle while the second (max) handle was invisible.
 */
const Slider = React.forwardRef(({ className, value, defaultValue, ...props }, ref) => {
  const arr = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [0];
  const count = Math.max(1, arr.length);

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"
      >
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-testid={`slider-thumb-${i}`}
          className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
