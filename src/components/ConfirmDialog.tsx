import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useI18n } from '../i18n'

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'info' | 'success';
  onClose: () => void;
  onConfirm: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = (props) => {
  const { tr } = useI18n()
  const {
    open,
    title,
    description,
    confirmText = tr('确认', 'Confirm'),
    cancelText = tr('取消', 'Cancel'),
    confirmColor = 'error',
    onClose,
    onConfirm,
  } = props
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelText}</Button>
        <Button onClick={onConfirm} color={confirmColor} autoFocus>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
