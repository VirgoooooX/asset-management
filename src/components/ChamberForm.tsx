import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Stack,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Asset, AssetAttachment, AssetStatus } from '../types';
import { addAsset, updateAsset } from '../store/assetsSlice';
import { useAppDispatch } from '../store/hooks';
import { useI18n } from '../i18n';
import { deleteFile } from '../services/storageService';
import AttachmentManagerCard from './AttachmentManagerCard';
import { uploadAssetAttachments, uploadAssetFiles } from '../utils/fileUpload';

interface ChamberFormProps {
  open: boolean;
  onClose: () => void;
  chamber?: Asset;
  onSaved?: (asset: Asset) => void;
}

const ChamberForm: React.FC<ChamberFormProps> = ({ open, onClose, chamber, onSaved }) => {
  const dispatch = useAppDispatch();
  const { tr } = useI18n();
  const [category, setCategory] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<AssetStatus>('available');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [owner, setOwner] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [photoUrlsText, setPhotoUrlsText] = useState('');
  const [nameplateUrlsText, setNameplateUrlsText] = useState('');
  const [calibrationDate, setCalibrationDate] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [nameplateUploading, setNameplateUploading] = useState(false);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AssetAttachment[]>([]);
  const [pendingUploadedUrls, setPendingUploadedUrls] = useState<string[]>([]);
  const [pendingDeletedPaths, setPendingDeletedPaths] = useState<string[]>([]);

  const [errors, setErrors] = useState({
    assetCode: false,
    name: false,
    manufacturer: false,
    model: false,
    location: false,
  });

  useEffect(() => {
    setUploadError(null);
    setPendingUploadedUrls([]);
    setPendingDeletedPaths([]);
    if (chamber) {
      setCategory(chamber.category || '');
      setAssetCode(chamber.assetCode || '');
      setName(chamber.name);
      setDescription(chamber.description || '');
      setStatus(chamber.status);
      setSerialNumber(chamber.serialNumber || '');
      setManufacturer(chamber.manufacturer || '');
      setModel(chamber.model || '');
      setOwner(chamber.owner || '');
      setTagsText(Array.isArray(chamber.tags) ? chamber.tags.join(', ') : '');
      setPhotoUrlsText(Array.isArray(chamber.photoUrls) ? chamber.photoUrls.join('\n') : '');
      setNameplateUrlsText(Array.isArray(chamber.nameplateUrls) ? chamber.nameplateUrls.join('\n') : '');
      setCalibrationDate(chamber.calibrationDate ? new Date(chamber.calibrationDate) : null);
      setLocation(chamber.location || '');
      setAttachments(Array.isArray(chamber.attachments) ? chamber.attachments : []);
    } else {
      setCategory('');
      setAssetCode('');
      setName('');
      setDescription('');
      setStatus('available');
      setSerialNumber('');
      setManufacturer('');
      setModel('');
      setOwner('');
      setTagsText('');
      setPhotoUrlsText('');
      setNameplateUrlsText('');
      setCalibrationDate(null);
      setLocation('');
      setAttachments([]);
      setErrors({ assetCode: false, name: false, manufacturer: false, model: false, location: false });
    }
  }, [chamber, open]);

  const parseList = (value: string) =>
    value
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter((s) => Boolean(s));

  const validateForm = () => {
    const newErrors = {
      assetCode: !assetCode.trim(),
      name: !name,
      manufacturer: !manufacturer,
      model: !model,
      location: !location.trim(),
    };
    setErrors(newErrors);
    return !(newErrors.assetCode || newErrors.name || newErrors.manufacturer || newErrors.model || newErrors.location);
  };

  const handleUploadImages = async (kind: 'photo' | 'nameplate', files: File[]) => {
    if (!chamber?.id || files.length === 0) return;

    setUploadError(null);
    if (kind === 'photo') setPhotoUploading(true);
    if (kind === 'nameplate') setNameplateUploading(true);

    try {
      const folder = kind === 'photo' ? 'photos' : 'nameplates';
      const urls = await uploadAssetFiles(chamber.id, folder, files);
      setPendingUploadedUrls((prev) => prev.concat(urls));
      if (kind === 'photo') {
        setPhotoUrlsText((prev) => parseList(prev).concat(urls).join('\n'));
      } else {
        setNameplateUrlsText((prev) => parseList(prev).concat(urls).join('\n'));
      }
    } catch (e: any) {
      setUploadError(e?.message || tr('上传失败', 'Upload failed'));
    } finally {
      if (kind === 'photo') setPhotoUploading(false);
      if (kind === 'nameplate') setNameplateUploading(false);
    }
  };

  const handleUploadAttachments = async (files: File[]) => {
    if (!chamber?.id || files.length === 0) return;

    setUploadError(null);
    setAttachmentsUploading(true);
    try {
      const newItems = await uploadAssetAttachments(chamber.id, 'attachments', files);
      setPendingUploadedUrls((prev) => prev.concat(newItems.map((item) => item.path || item.url)));
      setAttachments((prev) => prev.concat(newItems));
    } catch (e: any) {
      setUploadError(e?.message || tr('上传失败', 'Upload failed'));
    } finally {
      setAttachmentsUploading(false);
    }
  };

  const handleDeleteAttachment = (target: AssetAttachment) => {
    const targetPath = target.path || target.url;
    setAttachments((prev) => prev.filter((a) => a.id !== target.id));
    if (targetPath) {
      setPendingDeletedPaths((prev) => prev.concat([targetPath]));
    }
  };

  const handleCancel = () => {
    if (pendingUploadedUrls.length > 0) {
      void Promise.allSettled(pendingUploadedUrls.map((target) => deleteFile(target)));
    }
    setPendingUploadedUrls([]);
    setPendingDeletedPaths([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const chamberData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'chamber',
      category: category.trim() || undefined,
      assetCode: assetCode.trim(),
      name,
      description: description || undefined,
      status,
      location: location.trim(),
      serialNumber: serialNumber.trim() || undefined,
      manufacturer,
      model,
      owner: owner.trim() || undefined,
      tags: tagsText.trim() ? parseList(tagsText) : undefined,
      photoUrls: photoUrlsText.trim() ? parseList(photoUrlsText) : undefined,
      nameplateUrls: nameplateUrlsText.trim() ? parseList(nameplateUrlsText) : undefined,
      attachments: chamber ? attachments : undefined,
      calibrationDate: calibrationDate ? calibrationDate.toISOString() : undefined,
    };

    if (chamber && chamber.id) {
      const updated = await dispatch(
        updateAsset({
          id: chamber.id,
          changes: {
            category: chamberData.category,
            assetCode: chamberData.assetCode,
            name: chamberData.name,
            description: chamberData.description,
            status: chamberData.status,
            location: chamberData.location,
            serialNumber: chamberData.serialNumber,
            manufacturer: chamberData.manufacturer,
            model: chamberData.model,
            owner: chamberData.owner,
            tags: chamberData.tags,
            photoUrls: chamberData.photoUrls,
            nameplateUrls: chamberData.nameplateUrls,
            attachments: chamberData.attachments,
            calibrationDate: chamberData.calibrationDate,
          },
        })
      ).unwrap();
      if (pendingDeletedPaths.length > 0) {
        void Promise.allSettled(pendingDeletedPaths.map((target) => deleteFile(target)));
      }
      setPendingUploadedUrls([]);
      setPendingDeletedPaths([]);
      onSaved?.(updated);
    } else {
      const created = await dispatch(addAsset(chamberData)).unwrap();
      onSaved?.(created);
    }

    onClose();
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    setStatus(event.target.value as AssetStatus);
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>{chamber ? tr('编辑设备', 'Edit asset') : tr('新增设备', 'New asset')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}
            <TextField
              label={tr('设备种类', 'Category')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              placeholder={tr('例如：环境箱 / 温湿度箱 / 夹具...', 'e.g. chamber / temp-humidity / fixture...')}
            />
            <TextField
              label={tr('资产号', 'Asset code')}
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              fullWidth
              required
              error={errors.assetCode}
              helperText={errors.assetCode ? tr('请输入资产号', 'Asset code is required') : ''}
            />
            <TextField
              label={tr('名称', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              error={errors.name}
              helperText={errors.name ? tr('请输入名称', 'Name is required') : ''}
            />

            <TextField
              label="SN"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              fullWidth
            />

            <TextField
              label={tr('描述', 'Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />

            <FormControl fullWidth>
              <InputLabel>{tr('状态', 'Status')}</InputLabel>
              <Select
                value={status}
                label={tr('状态', 'Status')}
                onChange={handleStatusChange}
              >
                <MenuItem value="available">{tr('可用', 'Available')}</MenuItem>
                <MenuItem value="in-use">{tr('使用中', 'In use')}</MenuItem>
                <MenuItem value="maintenance">{tr('维护中', 'Maintenance')}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={tr('位置', 'Location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
              required
              error={errors.location}
              helperText={errors.location ? tr('请输入位置', 'Location is required') : ''}
            />
            <TextField
              label={tr('厂商', 'Manufacturer')}
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              fullWidth
              required
              error={errors.manufacturer}
              helperText={errors.manufacturer ? tr('请输入厂商', 'Manufacturer is required') : ''}
            />
            <TextField
              label={tr('型号', 'Model')}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              fullWidth
              required
              error={errors.model}
              helperText={errors.model ? tr('请输入型号', 'Model is required') : ''}
            />
            <TextField
              label={tr('负责人', 'Owner')}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              fullWidth
            />
            <TextField
              label={tr('标签', 'Tags')}
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              fullWidth
              placeholder={tr('多个标签用逗号或换行分隔', 'Separate tags with comma or new line')}
            />
            <DateTimePicker
              label={tr('校验日期', 'Calibration date')}
              value={calibrationDate}
              onChange={(newValue) => setCalibrationDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                },
              }}
            />
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  component="label"
                  size="small"
                  variant="outlined"
                  disabled={!chamber?.id || photoUploading}
                >
                  {photoUploading ? tr('上传中…', 'Uploading…') : tr('上传照片', 'Upload photos')}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.currentTarget.files ?? []);
                      e.currentTarget.value = '';
                      handleUploadImages('photo', selectedFiles);
                    }}
                  />
                </Button>
              </Box>
              <TextField
                label={tr('设备照片（URL）', 'Photos (URLs)')}
                value={photoUrlsText}
                onChange={(e) => setPhotoUrlsText(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                placeholder={tr('每行一个 URL（或用逗号分隔）', 'One URL per line (or separated by commas)')}
              />
            </Stack>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  component="label"
                  size="small"
                  variant="outlined"
                  disabled={!chamber?.id || nameplateUploading}
                >
                  {nameplateUploading ? tr('上传中…', 'Uploading…') : tr('上传铭牌', 'Upload nameplate')}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.currentTarget.files ?? []);
                      e.currentTarget.value = '';
                      handleUploadImages('nameplate', selectedFiles);
                    }}
                  />
                </Button>
              </Box>
              <TextField
                label={tr('铭牌照片（URL）', 'Nameplate photos (URLs)')}
                value={nameplateUrlsText}
                onChange={(e) => setNameplateUrlsText(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                placeholder={tr('每行一个 URL（或用逗号分隔）', 'One URL per line (or separated by commas)')}
              />
            </Stack>

            <AttachmentManagerCard
              title={tr('技术档案', 'Attachments')}
              variant="section"
              attachments={attachments}
              canManage
              uploading={attachmentsUploading}
              uploadDisabled={!chamber?.id}
              maxItems={8}
              openLabel={tr('打开', 'Open')}
              onUpload={handleUploadAttachments}
              onDelete={handleDeleteAttachment}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>{tr('取消', 'Cancel')}</Button>
          <Button type="submit" variant="contained" color="primary">
            {tr('保存', 'Save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChamberForm;
