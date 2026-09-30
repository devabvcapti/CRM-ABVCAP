import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function Pattern() {
  return (
    <Field className="max-w-xs">
      <FieldLabel htmlFor="input-demo-date">Date</FieldLabel>
      <Input id="input-demo-date" type="date" />
    </Field>
  )
}