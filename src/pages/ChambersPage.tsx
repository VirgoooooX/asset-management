import React from 'react';
import ChamberList from '../components/ChamberList';
import PageShell from '../components/PageShell';
import AcUnitIcon from '@mui/icons-material/AcUnit'
import TitleWithIcon from '../components/TitleWithIcon'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'

const ChambersPage: React.FC = () => {
  const navigate = useNavigate()
  const { tr } = useI18n()

  return (
    <PageShell title={<TitleWithIcon icon={<AcUnitIcon />}>{tr('设备列表', 'Assets')}</TitleWithIcon>}>
      <ChamberList 
        onView={(id) => navigate(`/assets/${id}`)}
        onEdit={(id) => navigate(`/assets/${id}?edit=1`)}
        onAddNew={() => navigate('/assets/new')}
      />
    </PageShell>
  );
};

export default ChambersPage;
