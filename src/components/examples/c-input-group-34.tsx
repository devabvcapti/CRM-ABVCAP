import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { PlusIcon, PaperclipIcon, ImageIcon, BrainIcon, SearchIcon, ShoppingBagIcon, SparklesIcon, BookOpenIcon, GlobeIcon, LayoutDashboardIcon, AppWindowIcon, MicIcon, AudioLinesIcon } from "lucide-react"

export function Pattern() {
  return (
    <Field className="max-w-3xl">
      <InputGroup className="bg-background rounded-full h-14 border p-1.5">
        <InputGroupAddon className="border-none pl-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <InputGroupButton
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground rounded-full size-10"
                />
              }
            >
              <PlusIcon className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={12}
              className="w-56"
            >
              <DropdownMenuItem>
                <PaperclipIcon
                />
                <span>Add photos & files</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="-mx-3" />
              <DropdownMenuItem>
                <ImageIcon
                />
                <span>Create image</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BrainIcon
                />
                <span>Thinking</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SearchIcon
                />
                <span>Deep research</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ShoppingBagIcon
                />
                <span>Shopping research</span>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <SparklesIcon
                  />
                  <span>More</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem>
                    <BookOpenIcon
                    />
                    <span>Study and learn</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <GlobeIcon
                    />
                    <span>Web search</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <LayoutDashboardIcon
                    />
                    <span>Canvas</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <AppWindowIcon
                    />
                    <span>Explore apps</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>

        <InputGroupInput
          placeholder="Ask anything"
          className="placeholder:text-muted-foreground/70 border-none px-2 text-lg shadow-none focus-visible:ring-0"
        />

        <InputGroupAddon align="inline-end" className="gap-2 border-none pr-1">
          <InputGroupButton
            variant="ghost"
            className="text-muted-foreground hover:text-foreground rounded-full size-11"
          >
            <MicIcon className="size-5" />
          </InputGroupButton>
          <InputGroupButton
            variant="default"
            className="rounded-full size-11 bg-black text-white hover:bg-black/90"
          >
            <AudioLinesIcon className="size-5" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}