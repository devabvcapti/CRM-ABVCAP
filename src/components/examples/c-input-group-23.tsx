import { Field } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SparklesIcon, CommandIcon } from "lucide-react"

export function Pattern() {
  return (
    <Field className="max-w-xs">
      <InputGroup>
        <InputGroupAddon>
          <SparklesIcon className="text-emerald-500" />
        </InputGroupAddon>
        <InputGroupInput placeholder="Ask AI to generate..." />
        <InputGroupAddon align="inline-end">
          <KbdGroup>
            <Kbd>
              <CommandIcon className="size-3" />
            </Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}