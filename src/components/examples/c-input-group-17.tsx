"use client"

import { useState } from "react"

import { Field } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { InfoIcon } from "lucide-react"

export function Pattern() {
  const [value, setValue] = useState("")
  const maxLength = 140

  return (
    <Field className="max-w-xs">
      <InputGroup>
        <InputGroupTextarea
          placeholder="Description..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={maxLength}
          className="min-h-16 pb-12"
        />
        <InputGroupAddon align="block-end">
          <InputGroupText className="text-muted-foreground text-xs">
            {value.length}/{maxLength} characters
          </InputGroupText>
          <InfoIcon className="text-muted-foreground ml-auto" />
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}