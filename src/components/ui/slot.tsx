import * as React from "react";

/**
 * Minimal Slot: merges the component's props onto its single child element,
 * so `<Button asChild><Link/></Button>` renders a single anchor. A tiny local
 * stand-in for @radix-ui/react-slot to avoid the extra dependency.
 */
export const Slot = React.forwardRef<HTMLElement, { children?: React.ReactNode } & Record<string, unknown>>(
  ({ children, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    const childProps = children.props as Record<string, unknown>;
    return React.cloneElement(children, {
      ...props,
      ...childProps,
      className: [(props as { className?: string }).className, childProps.className]
        .filter(Boolean)
        .join(" "),
      ref,
    } as React.Attributes);
  }
);
Slot.displayName = "Slot";
