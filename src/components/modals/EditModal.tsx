'use client'

import { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Save, X, Loader2 } from 'lucide-react'

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  title: string | ReactNode
  children: ReactNode
  onSave: () => void
  onCancel?: () => void
  isLoading?: boolean
  saveButtonText?: string
  cancelButtonText?: string
  className?: string
}

export function EditModal({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  onCancel,
  isLoading = false,
  saveButtonText = 'Save',
  cancelButtonText = 'Cancel',
  className
}: EditModalProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-[650px] p-0 gap-0 bg-white rounded-xl border border-slate-200 shadow-xl ${className || ''}`}>
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100">
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        
        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 sm:gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
            {cancelButtonText}
          </Button>
          <Button 
            type="button" 
            onClick={onSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all duration-200"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {saveButtonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}