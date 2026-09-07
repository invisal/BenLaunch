import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Switch } from "@base-ui/react/switch";
import { cn } from "cnfast";

/**
 * A form for framed-window screens. Each row centers its control in the window
 * with the label hanging off to the left in a fixed-width column (a mirrored
 * spacer on the right keeps the control column optically centered). Drop it
 * inside `Layout.Content`; submit/cancel usually live in `Layout.Footer`.
 *
 *   <Form onSubmit={save}>
 *     <Form.Field label="Name">
 *       <Form.Input value={name} onChange={(e) => setName(e.target.value)} />
 *     </Form.Field>
 *     <Form.Checkbox
 *       label="Expose as a launcher command"
 *       checked={exposed}
 *       onChange={(e) => setExposed(e.target.checked)}
 *     />
 *   </Form>
 *
 * The form is controlled by its inputs, so `onSubmit` is optional — pass it only
 * when you want Enter-to-submit (and a `type="submit"` button); it fires after
 * `preventDefault()`. `labelWidth` (default 128) and `controlWidth` (default
 * 340) size the two columns, in px.
 */

interface FormLayout {
  labelWidth: number;
  controlWidth: number;
}

const FormContext = createContext<FormLayout>({
  labelWidth: 128,
  controlWidth: 340,
});

function FormRoot({
  onSubmit,
  labelWidth = 128,
  controlWidth = 340,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"form"> & {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Width of the right-aligned label column, in px. */
  labelWidth?: number;
  /** Max width of the centered control column, in px. */
  controlWidth?: number;
}) {
  return (
    <FormContext.Provider value={{ labelWidth, controlWidth }}>
      <form
        {...rest}
        onSubmit={
          onSubmit &&
          ((event) => {
            event.preventDefault();
            onSubmit(event);
          })
        }
        className={cn("flex w-full flex-col gap-4 mt-6", className)}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
}

/** The centered three-track row shared by `Field`, `Switch` and `Actions`:
 * `[label] [control] [spacer]`, the spacer mirroring the label column so the
 * control column sits in the middle of the window. `left` is the label cell's
 * contents — a `<label>` element for `Field`, nothing for the rest. */
function Row({
  left,
  children,
  className,
}: {
  left?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { labelWidth, controlWidth } = useContext(FormContext);
  return (
    <div className={cn("flex justify-center gap-4", className)}>
      <div
        style={{ width: labelWidth }}
        className="shrink-0 pt-2 text-right text-sm text-foreground-subtle"
      >
        {left}
      </div>
      <div
        className="flex w-full min-w-0 flex-col gap-1.5"
        style={{ maxWidth: controlWidth }}
      >
        {children}
      </div>
      <span aria-hidden className="shrink-0" style={{ width: labelWidth }} />
    </div>
  );
}

/* --------------------------------- field ---------------------------------- */

interface FieldContextValue {
  id: string;
  descriptionId: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * A labelled control with optional helper text and an error slot. The label is
 * wired to whatever control you nest (via context), so it works with
 * `Form.Input`, a `<textarea>`, or a `<select>`.
 */
function Field({
  label,
  description,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  /** Helper text shown under the control. */
  description?: ReactNode;
  /** When set, the field renders its error state and shows this below. */
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const descriptionId = description || error ? `${id}-description` : undefined;

  return (
    <FieldContext.Provider
      value={{ id, descriptionId, invalid: Boolean(error) }}
    >
      <Row
        className={className}
        left={
          <label htmlFor={id}>
            {label}
            {required ? <span className="text-red-500"> *</span> : null}
          </label>
        }
      >
        {children}
        {error ? (
          <p id={descriptionId} className="text-xs text-red-500">
            {error}
          </p>
        ) : description ? (
          <p id={descriptionId} className="text-xs text-foreground-subtle">
            {description}
          </p>
        ) : null}
      </Row>
    </FieldContext.Provider>
  );
}

/** Read the enclosing `Form.Field`'s wiring, if any. Exported for custom
 * controls (a `<textarea>`, a picker) that want the same label/aria hookup. */
export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

/* ---------------------------- input / textarea --------------------------- */

/** Shared styling for the text controls. */
const CONTROL_CLASS = cn(
  "w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground outline-none",
  "placeholder:text-foreground-subtle focus:border-foreground-subtle",
  "aria-invalid:border-red-500",
);

/** Wiring an enclosing `Form.Field` supplies to its control. */
function useFieldControlProps(rest: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: ComponentPropsWithoutRef<"input">["aria-invalid"];
}) {
  const field = useContext(FieldContext);
  return {
    id: field?.id ?? rest.id,
    "aria-describedby": field?.descriptionId ?? rest["aria-describedby"],
    "aria-invalid": field?.invalid || rest["aria-invalid"] || undefined,
  };
}

/** A text input styled for the framed windows. Works standalone or inside a
 * `Form.Field` (which supplies its `id` and error state). */
const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        {...useFieldControlProps(rest)}
        className={cn(CONTROL_CLASS, className)}
      />
    );
  },
);

/** A multi-line text input. Same styling and `Form.Field` wiring as `Input`;
 * vertically resizable, three rows tall by default. */
const TextArea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(function TextArea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...rest}
      {...useFieldControlProps(rest)}
      className={cn(CONTROL_CLASS, "resize-y", className)}
    />
  );
});

/**
 * A control shaped like an `Input` but acting as a button, with a trailing "→".
 * For a field whose value is edited on another screen — put the current value
 * (or a type name) as the children and navigate on `onClick`.
 *
 *   <Form.Field label="Code">
 *     <Form.Trigger onClick={editCode}>TypeScript</Form.Trigger>
 *   </Form.Field>
 */
const Trigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>(function Trigger({ className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      {...useFieldControlProps(rest)}
      className={cn(
        CONTROL_CLASS,
        "flex items-center justify-between gap-2 text-left",
        "enabled:hover:border-foreground-subtle disabled:opacity-50",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <span aria-hidden className="shrink-0 text-foreground-subtle">
        →
      </span>
    </button>
  );
});

/* -------------------------------- switch -------------------------------- */

/** An on/off toggle with its label alongside (label on the right), sitting in
 * the centered control column like the fields above it. Built on Base UI's
 * Switch; props pass through to `Switch.Root` (`checked`, `onCheckedChange`,
 * `disabled`, `name`, …). */
function FormSwitch({
  label,
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<typeof Switch.Root>, "className"> & {
  label: ReactNode;
  className?: string;
}) {
  return (
    <Row className={className}>
      <label className="flex items-center gap-2.5 py-1 text-sm text-foreground-subtle">
        <Switch.Root
          {...rest}
          className="relative h-5 w-9 shrink-0 rounded-full bg-input p-0.5 outline-none transition-colors focus-visible:border focus-visible:border-foreground-subtle data-[checked]:bg-foreground"
        >
          <Switch.Thumb className="block h-4 w-4 rounded-full bg-foreground shadow transition-transform data-[checked]:translate-x-4 data-[checked]:bg-background" />
        </Switch.Root>
        {label}
      </label>
    </Row>
  );
}

/* -------------------------------- actions ------------------------------- */

/** A right-aligned button row aligned to the form's control column, for forms
 * that keep their actions inline instead of in `Layout.Footer`. */
function Actions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Row className={cn("pt-2", className)}>
      <div className="flex items-center justify-end gap-3">{children}</div>
    </Row>
  );
}

export const Form = Object.assign(FormRoot, {
  Field,
  Input,
  TextArea,
  Trigger,
  Switch: FormSwitch,
  Actions,
});
