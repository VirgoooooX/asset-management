import React from 'react'
import { Box, Chip, Divider, Grid, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import PhotoIcon from '@mui/icons-material/Photo'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import AppCard from '../../components/AppCard'
import TitleWithIcon from '../../components/TitleWithIcon'
import StatusChip from '../../components/StatusChip'
import AssetMediaGalleryCard from '../../components/AssetMediaGalleryCard'
import AttachmentManagerCard from '../../components/AttachmentManagerCard'
import type { Asset, AssetAttachment, RepairTicket, UsageLog } from '../../types'
import { getEffectiveUsageLogStatus } from '../../utils/statusHelpers'
import { formatDateTime } from '../../utils/formatters'
import { useI18n } from '../../i18n'
import type { LightboxImageState } from '../../components/ImageLightboxDialog'

type InfoRowProps = {
  label: React.ReactNode
  value: React.ReactNode
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
      gap: { xs: 0.5, sm: 2 },
      alignItems: 'baseline',
    }}
  >
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 850 }}>
      {label}
    </Typography>
    <Box sx={{ minWidth: 0 }}>{value}</Box>
  </Box>
)

interface AssetInfoTabProps {
  mode: 'create' | 'view'
  asset?: Asset
  assetId?: string
  isAdmin: boolean
  latestUsageLog?: UsageLog
  latestRepairTicket?: RepairTicket
  projectNameById: Map<string, string>
  testProjectNameById: Map<string, string>
  photoUploading: boolean
  nameplateUploading: boolean
  attachmentsUploading: boolean
  onUploadImages: (kind: 'photo' | 'nameplate', files: File[]) => void
  onRequestDeleteImage: (kind: 'photo' | 'nameplate', url: string) => void
  onPreviewImage: (state: LightboxImageState) => void
  onUploadAttachments: (files: File[]) => void
  onRequestDeleteAttachment: (attachment: AssetAttachment) => void
}

const AssetInfoTab: React.FC<AssetInfoTabProps> = ({
  mode,
  asset,
  assetId,
  isAdmin,
  latestUsageLog,
  latestRepairTicket,
  projectNameById,
  testProjectNameById,
  photoUploading,
  nameplateUploading,
  attachmentsUploading,
  onUploadImages,
  onRequestDeleteImage,
  onPreviewImage,
  onUploadAttachments,
  onRequestDeleteAttachment,
}) => {
  const { tr } = useI18n()

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} lg={7}>
        <AppCard title={tr('基础信息', 'Basic info')} contentSx={{ pl: { xs: 0, sm: 2 }, pr: { xs: 0, sm: 0.5 } }}>
          {!asset && mode === 'view' ? (
            <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
          ) : (
            <Stack spacing={2.25}>
              <Stack spacing={1.25}>
                <Typography sx={{ fontWeight: 950 }}>{tr('概览', 'Overview')}</Typography>
                <InfoRow
                  label={tr('位置', 'Location')}
                  value={<Typography sx={{ fontWeight: 850 }}>{asset?.location || '-'}</Typography>}
                />
                <InfoRow
                  label={tr('负责人', 'Owner')}
                  value={<Typography sx={{ fontWeight: 850 }}>{asset?.owner || '-'}</Typography>}
                />
                <InfoRow
                  label={tr('标签', 'Tags')}
                  value={
                    asset?.tags?.length ? (
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {asset.tags.map((t) => (
                          <Chip key={t} size="small" label={t} sx={{ fontWeight: 850 }} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography sx={{ fontWeight: 850 }}>-</Typography>
                    )
                  }
                />
              </Stack>

              <Divider />

              <Stack spacing={1.25}>
                <Typography sx={{ fontWeight: 950 }}>{tr('资产信息', 'Asset')}</Typography>
                <InfoRow
                  label={tr('设备种类', 'Category')}
                  value={<Typography sx={{ fontWeight: 850 }}>{asset?.category || tr('环境箱', 'Chamber')}</Typography>}
                />
                <InfoRow
                  label={tr('厂商 / 型号', 'Manufacturer / Model')}
                  value={<Typography sx={{ fontWeight: 850 }}>{`${asset?.manufacturer || '-'} / ${asset?.model || '-'}`}</Typography>}
                />
                <InfoRow label={tr('资产号', 'Asset code')} value={<Typography sx={{ fontWeight: 850 }}>{asset?.assetCode || '-'}</Typography>} />
                <InfoRow label="SN" value={<Typography sx={{ fontWeight: 850 }}>{asset?.serialNumber || '-'}</Typography>} />
              </Stack>

              <Divider />

              <Stack spacing={1.25}>
                <Typography sx={{ fontWeight: 950 }}>{tr('校验与时间', 'Maintenance & time')}</Typography>
                <InfoRow label={tr('校验日期', 'Calibration date')} value={<Typography sx={{ fontWeight: 850 }}>{formatDateTime(asset?.calibrationDate)}</Typography>} />
                <InfoRow label={tr('创建时间', 'Created')} value={<Typography sx={{ fontWeight: 850 }}>{formatDateTime(asset?.createdAt)}</Typography>} />
                <InfoRow label={tr('更新时间', 'Updated')} value={<Typography sx={{ fontWeight: 850 }}>{formatDateTime(asset?.updatedAt ?? asset?.createdAt)}</Typography>} />
              </Stack>

              <Divider />

              <Stack spacing={1.25}>
                <Typography sx={{ fontWeight: 950 }}>{tr('关联记录', 'Related')}</Typography>
                <InfoRow
                  label={tr('最近一次使用', 'Latest usage')}
                  value={
                    latestUsageLog ? (
                      (() => {
                        const effectiveStatus = getEffectiveUsageLogStatus(latestUsageLog)
                        const projectName = latestUsageLog.projectId ? projectNameById.get(latestUsageLog.projectId) : undefined
                        const testProjectName = latestUsageLog.testProjectId ? testProjectNameById.get(latestUsageLog.testProjectId) : undefined
                        return (
                          <Box
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              p: 1.25,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5,
                              backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.6),
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 850 }} noWrap>
                                {projectName ?? testProjectName ?? tr('未关联项目', 'Unlinked')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {formatDateTime(latestUsageLog.startTime)} → {formatDateTime(latestUsageLog.endTime)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {tr('使用人：', 'User: ')}
                                {latestUsageLog.user || '-'}
                              </Typography>
                            </Box>
                            <StatusChip kind="usage" status={effectiveStatus} />
                          </Box>
                        )
                      })()
                    ) : (
                      <Typography sx={{ fontWeight: 850 }}>-</Typography>
                    )
                  }
                />
                <InfoRow
                  label={tr('最近一条维修', 'Latest repair')}
                  value={
                    latestRepairTicket ? (
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.25,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.6),
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 850 }} noWrap>
                            {latestRepairTicket.problemDesc || tr('维修工单', 'Repair ticket')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {tr('更新时间：', 'Updated: ')}
                            {formatDateTime(latestRepairTicket.updatedAt ?? latestRepairTicket.createdAt)}
                          </Typography>
                        </Box>
                        <StatusChip kind="repair" status={latestRepairTicket.status} />
                      </Box>
                    ) : (
                      <Typography sx={{ fontWeight: 850 }}>-</Typography>
                    )
                  }
                />
              </Stack>

              <Divider />

              <Stack spacing={0.75}>
                <Typography sx={{ fontWeight: 950 }}>{tr('描述', 'Description')}</Typography>
                <Typography>{asset?.description || '-'}</Typography>
              </Stack>
            </Stack>
          )}
        </AppCard>
      </Grid>

      <Grid item xs={12} lg={5}>
        <Stack spacing={2}>
          <AppCard title={tr('成本配置', 'Cost')}>
            <Stack spacing={1.25}>
              <InfoRow
                label={tr('计费口径', 'Billing rule')}
                value={<Typography sx={{ fontWeight: 850 }}>{tr('按小时计费（向上取整）', 'Hourly billing (ceil)')}</Typography>}
              />
              <InfoRow
                label={tr('小时费率', 'Hourly rate')}
                value={<Typography sx={{ fontWeight: 850 }}>{tr('按设备类型统一配置', 'Configured by category')}</Typography>}
              />
              <InfoRow
                label={tr('设备类型', 'Category')}
                value={<Typography sx={{ fontWeight: 850 }}>{asset?.category || tr('未分类', 'Uncategorized')}</Typography>}
              />
            </Stack>
          </AppCard>

          <AssetMediaGalleryCard
            title={<TitleWithIcon icon={<PhotoIcon />}>{tr('设备照片', 'Photos')}</TitleWithIcon>}
            urls={asset?.photoUrls ?? []}
            altText={tr('设备照片', 'Asset photo')}
            emptyText={tr('暂无照片', 'No photos')}
            canUpload={isAdmin && mode === 'view' && Boolean(assetId)}
            canDelete={isAdmin}
            uploading={photoUploading}
            onUpload={(files) => onUploadImages('photo', files)}
            onDelete={(url) => onRequestDeleteImage('photo', url)}
            onPreview={(index) =>
              onPreviewImage({
                title: tr('设备照片', 'Photos'),
                urls: asset?.photoUrls ?? [],
                index,
              })
            }
          />

          <AssetMediaGalleryCard
            title={<TitleWithIcon icon={<QrCode2Icon />}>{tr('铭牌', 'Nameplate')}</TitleWithIcon>}
            urls={asset?.nameplateUrls ?? []}
            altText={tr('铭牌', 'Nameplate')}
            emptyText={tr('暂无铭牌信息', 'No nameplate')}
            canUpload={isAdmin && mode === 'view' && Boolean(assetId)}
            canDelete={isAdmin}
            uploading={nameplateUploading}
            onUpload={(files) => onUploadImages('nameplate', files)}
            onDelete={(url) => onRequestDeleteImage('nameplate', url)}
            onPreview={(index) =>
              onPreviewImage({
                title: tr('铭牌', 'Nameplate'),
                urls: asset?.nameplateUrls ?? [],
                index,
              })
            }
          />

          <AttachmentManagerCard
            title={<TitleWithIcon icon={<AttachFileIcon />}>{tr('技术档案', 'Attachments')}</TitleWithIcon>}
            attachments={asset?.attachments ?? []}
            canManage={isAdmin && mode === 'view' && Boolean(assetId)}
            uploading={attachmentsUploading}
            maxItems={8}
            onUpload={onUploadAttachments}
            onDelete={onRequestDeleteAttachment}
          />
        </Stack>
      </Grid>
    </Grid>
  )
}

export default AssetInfoTab
