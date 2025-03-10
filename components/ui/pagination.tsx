import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Aseguramos que siempre haya al menos 1 página
  const effectiveTotalPages = Math.max(1, totalPages)

  const createPageArray = () => {
    const pages = []
    const showEllipsis = effectiveTotalPages > 7

    if (!showEllipsis) {
      for (let i = 1; i <= effectiveTotalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // Siempre mostrar primera página
    pages.push(1)

    if (currentPage > 3) {
      pages.push('ellipsis')
    }

    // Páginas alrededor de la página actual
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(effectiveTotalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }

    if (currentPage < effectiveTotalPages - 2) {
      pages.push('ellipsis')
    }

    // Siempre mostrar última página si hay más de una
    if (effectiveTotalPages > 1) {
      pages.push(effectiveTotalPages)
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="flex items-center gap-6">
        <div className="text-sm text-muted-foreground">
          Página {currentPage} de {effectiveTotalPages}
        </div>
        <div className="flex items-center space-x-2">
          <PaginationButton
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Página anterior</span>
          </PaginationButton>
          {createPageArray().map((page, i) => (
            <React.Fragment key={i}>
              {page === 'ellipsis' ? (
                <div className="flex items-center">
                  <MoreHorizontal className="h-4 w-4" />
                </div>
              ) : (
                <PaginationButton
                  onClick={() => onPageChange(page as number)}
                  variant={currentPage === page ? "default" : "outline"}
                >
                  {page}
                </PaginationButton>
              )}
            </React.Fragment>
          ))}
          <PaginationButton
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === effectiveTotalPages}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Página siguiente</span>
          </PaginationButton>
        </div>
      </div>
    </div>
  )
}

interface PaginationButtonProps extends ButtonProps {}

function PaginationButton({
  className,
  variant = "outline",
  ...props
}: PaginationButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants({
          variant,
          size: "icon",
        }),
        className
      )}
      {...props}
    />
  )
} 