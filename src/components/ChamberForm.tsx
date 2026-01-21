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
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'; // 新增
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'; // 新增
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'; // 新增
import { Asset, AssetAttachment, AssetStatus } from '../types'
import { addAsset, updateAsset } from '../store/assetsSlice'
import { useAppDispatch } from '../store/hooks'
import { useI18n } from '../i18n'
import { deleteFile, uploadFile } from '../services/storageService'

interface ChamberFormProps {
  open: boolean;
  onClose: () => void;
  chamber?: Asset;
  onSaved?: (asset: Asset) => void
}

const ChamberForm: React.FC<ChamberFormProps> = ({ open, onClose, chamber, onSaved }) => {
  const dispatch = useAppDispatch()
  const { tr, dateFnsLocale } = useI18n()
  const [category, setCategory] = useState('')
  const [assetCode, setAssetCode] = useState('')
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<AssetStatus>('available')
  const [serialNumber, setSerialNumber] = useState('')
  const [manufacturer, setManufacturer] = useState(''); // 新增
  const [model, setModel] = useState(''); // 新增
  const [owner, setOwner] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [photoUrlsText, setPhotoUrlsText] = useState('')
  const [nameplateUrlsText, setNameplateUrlsText] = useState('')
  const [calibrationDate, setCalibrationDate] = useState<Date | null>(null); // 新增
  const [location, setLocation] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [nameplateUploading, setNameplateUploading] = useState(false)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AssetAttachment[]>([])

  // 表单验证
  const [errors, setErrors] = useState({
    assetCode: false,
    name: false,
    manufacturer: false, // 新增
    model: false,       // 新增
    location: false,
  });

  useEffect(() => {
    if (chamber) {
      setCategory(chamber.category || '')
      setAssetCode(chamber.assetCode || '')
      setName(chamber.name);
      setDescription(chamber.description || '');
      setStatus(chamber.status);
      setSerialNumber(chamber.serialNumber || '')
      setManufacturer(chamber.manufacturer || '');
      setModel(chamber.model || '');
      setOwner(chamber.owner || '')
      setTagsText(Array.isArray(chamber.tags) ? chamber.tags.join(', ') : '')
      setPhotoUrlsText(Array.isArray(chamber.photoUrls) ? chamber.photoUrls.join('\n') : '')
      setNameplateUrlsText(Array.isArray(chamber.nameplateUrls) ? chamber.nameplateUrls.join('\n') : '')
      // Parse date strings back to Date objects
      setCalibrationDate(chamber.calibrationDate ? new Date(chamber.calibrationDate) : null);
      setLocation(chamber.location || '')
      setAttachments(Array.isArray(chamber.attachments) ? chamber.attachments : [])
    } else {
      // 重置表单
      setCategory('')
      setAssetCode('')
      setName('');
      setDescription('');
      setStatus('available');
      setSerialNumber('')
      setManufacturer(''); // 新增
      setModel(''); // 新增
      setOwner('')
      setTagsText('')
      setPhotoUrlsText('')
      setNameplateUrlsText('')
      setCalibrationDate(null); // 新增
      setLocation('')
      setAttachments([])
      setErrors({ assetCode: false, name: false, manufacturer: false, model: false, location: false }); // 重置错误状态
    }
  }, [chamber, open]);

  const parseList = (value: string) =>
    value
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter((s) => Boolean(s))

  const validateForm = () => { // 新增验证逻辑
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

  const sanitizeFileName = (name: string) =>
    name
      .replace(/[^\w.\-() ]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120)

  const createObjectKey = (fileName: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    return `${id}-${sanitizeFileName(fileName)}`
  }

  const handleUploadImages = async (kind: 'photo' | 'nameplate', files: FileList | null) => {
    if (!chamber?.id) return
    if (!files || files.length === 0) return

    setUploadError(null)
    if (kind === 'photo') setPhotoUploading(true)
    if (kind === 'nameplate') setNameplateUploading(true)

    try {
      const list = Array.from(files)
      const urls = await Promise.all(
        list.map((file) => {
          const objectKey = createObjectKey(file.name)
          const folder = kind === 'photo' ? 'photos' : 'nameplates'
          const path = `assets/${chamber.id}/${folder}/${objectKey}`
          return uploadFile(file, path)
        })
      )

      if (kind === 'photo') {
        const nextText = parseList(photoUrlsText).concat(urls).join('\n')
        setPhotoUrlsText(nextText)
        await dispatch(updateAsset({ id: chamber.id, changes: { photoUrls: parseList(nextText) } })).unwrap()
      } else {
        const nextText = parseList(nameplateUrlsText).concat(urls).join('\n')
        setNameplateUrlsText(nextText)
        await dispatch(updateAsset({ id: chamber.id, changes: { nameplateUrls: parseList(nextText) } })).unwrap()
      }
    } catch (e: any) {
      setUploadError(e?.message || tr('上传失败', 'Upload failed'))
    } finally {
      if (kind === 'photo') setPhotoUploading(false)
      if (kind === 'nameplate') setNameplateUploading(false)
    }
  }

  const formatBytes = (value?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
    if (value < 1024) return `${value} B`
    const kb = value / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }

  const handleUploadAttachments = async (files: FileList | null) => {
    if (!chamber?.id) return
    if (!files || files.length === 0) return

    setUploadError(null)
    setAttachmentsUploading(true)
    try {
      const list = Array.from(files)
      const newItems = await Promise.all(
        list.map(async (file) => {
          const objectKey = createObjectKey(file.name)
          const path = `assets/${chamber.id}/attachments/${objectKey}`
          const url = await uploadFile(file, path)
          return {
            id: objectKey,
            name: file.name,
            url,
            path,
            contentType: file.type || undefined,
            size: typeof file.size === 'number' ? file.size : undefined,
            uploadedAt: new Date().toISOString(),
          } as AssetAttachment
        })
      )

      const merged = attachments.concat(newItems)
      setAttachments(merged)
      await dispatch(updateAsset({ id: chamber.id, changes: { attachments: merged } })).unwrap()
    } catch (e: any) {
      setUploadError(e?.message || tr('上传失败', 'Upload failed'))
    } finally {
      setAttachmentsUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!chamber?.id) return
    const target = attachments.find((a) => a.id === attachmentId)
    if (!target) return

    setUploadError(null)
    try {
      await deleteFile(target.path || target.url)
      const next = attachments.filter((a) => a.id !== attachmentId)
      setAttachments(next)
      await dispatch(updateAsset({ id: chamber.id, changes: { attachments: next } })).unwrap()
    } catch (e: any) {
      setUploadError(e?.message || tr('删除失败', 'Delete failed'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { // 更新验证调用
      return;
    }
    
    const chamberData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'chamber',
      category: category.trim() || undefined,
      assetCode: assetCode.trim(),
      name,
      description: description || undefined,
      status,
      location: location.trim(),
      serialNumber: serialNumber.trim() || undefined,
      manufacturer, // 新增
      model, // 新增
      owner: owner.trim() || undefined,
      tags: tagsText.trim() ? parseList(tagsText) : undefined,
      photoUrls: photoUrlsText.trim() ? parseList(photoUrlsText) : undefined,
      nameplateUrls: nameplateUrlsText.trim() ? parseList(nameplateUrlsText) : undefined,
      // Convert dates to ISO strings for serialization
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
            calibrationDate: chamberData.calibrationDate,
          },
        })
      ).unwrap()
      onSaved?.(updated)
    } else {
      const created = await dispatch(addAsset(chamberData)).unwrap()
      onSaved?.(created)
    }
    
    onClose();
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    setStatus(event.target.value as AssetStatus)
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth> {/* 调整宽度以容纳更多字段 */}
      <DialogTitle>{chamber ? tr('编辑设备', 'Edit asset') : tr('新增设备', 'New asset')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
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
                error={errors.name} // 新增
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

              {/* 新增字段 */}
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
                  }
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
                        const files = e.target.files
                        e.target.value = ''
                        handleUploadImages('photo', files)
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
                        const files = e.target.files
                        e.target.value = ''
                        handleUploadImages('nameplate', files)
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

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 850 }}>
                    {tr('技术档案', 'Attachments')}
                  </Typography>
                  <Button component="label" size="small" variant="outlined" disabled={!chamber?.id || attachmentsUploading}>
                    {attachmentsUploading ? tr('上传中…', 'Uploading…') : tr('上传附件', 'Upload')}
                    <input
                      hidden
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        e.target.value = ''
                        handleUploadAttachments(files)
                      }}
                    />
                  </Button>
                </Box>

                {attachments.length ? (
                  <Stack spacing={1}>
                    {attachments.slice(0, 8).map((a) => (
                      <Box
                        key={a.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.25,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.25,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 850 }} noWrap>
                            {a.name || tr('未命名文件', 'Untitled')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {formatBytes(a.size)} · {new Date(a.uploadedAt).toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                          <Button size="small" variant="outlined" component="a" href={a.url} target="_blank" rel="noreferrer">
                            {tr('打开', 'Open')}
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteAttachment(a.id)}>
                            {tr('删除', 'Delete')}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'),
                      borderRadius: 2,
                      p: 2,
                      textAlign: 'center',
                    }}
                  >
                    <Typography sx={{ fontWeight: 850 }}>{tr('暂无附件', 'No attachments')}</Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{tr('取消', 'Cancel')}</Button>
          <Button type="submit" variant="contained" color="primary">
            {tr('保存', 'Save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChamberForm;
