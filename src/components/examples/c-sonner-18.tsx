import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"

export function Pattern() {
  return (
    <div className="flex items-center justify-center">
      <Button
        onClick={() =>
          toast.add({
            title: "File uploaded successfully",
            description: "report-2025.pdf has been saved to your documents.",
          })
        }
        variant="outline"
        className="w-fit"
      >
        Toast with Close Button
      </Button>
    </div>
  )
}
