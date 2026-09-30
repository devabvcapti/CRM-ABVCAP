import { Field } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group"

export function Pattern() {
  return (
    <Field className="max-w-xs" data-invalid="true">
      <InputGroup>
        <InputGroupInput placeholder="Invalid field" aria-invalid="true" />
      </InputGroup>
    </Field>
  )
}