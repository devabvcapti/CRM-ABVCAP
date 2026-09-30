import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function Pattern() {
  return (
    <Field className="max-w-xs">
      <FieldLabel htmlFor="company">
        Company <span className="text-destructive">*</span>
      </FieldLabel>
      <Input id="company" placeholder="Wotso Inc." />
    </Field>
  )
}