import { Field } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

export function Pattern() {
  return (
    <Field className="max-w-xs">
      <InputGroup>
        <InputGroupTextarea
          placeholder="Share your thoughts..."
          className="min-h-24"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton variant="secondary" size="sm">
            Cancel
          </InputGroupButton>
          <InputGroupButton variant="default" size="sm" className="ml-auto">
            Post Comment
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}