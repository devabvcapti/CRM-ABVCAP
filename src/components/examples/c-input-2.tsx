import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function Pattern() {
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel htmlFor="input-demo-email">Email</FieldLabel>
      <Input
        id="input-demo-email"
        type="email"
        placeholder="name@example.com"
      />
    </Field>
  )
}