import React, { useState } from 'react';
import ProjectList from '../components/ProjectList';
import ProjectForm from '../components/ProjectForm';
import ProjectDetails from '../components/ProjectDetails';
import { Project } from '../types';
import { useAppSelector } from '../store/hooks'
import PageShell from '../components/PageShell';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import TitleWithIcon from '../components/TitleWithIcon'
import { useI18n } from '../i18n'

const ProjectsPage: React.FC = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { projects } = useAppSelector((state) => state.projects)
  const { tr } = useI18n()

  const handleAddNew = () => {
    setSelectedProject(undefined);
    setFormOpen(true);
  };

  const handleEdit = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      setSelectedProject(project);
      setFormOpen(true);
    }
  };

  const handleViewDetails = (id: string) => {
    setSelectedProjectId(id);
    setDetailsOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedProject(undefined);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedProjectId(null);
  };

  return (
    <PageShell title={<TitleWithIcon icon={<BusinessCenterIcon />}>{tr('项目', 'Projects')}</TitleWithIcon>}>
      <ProjectList 
        onEdit={handleEdit}
        onAddNew={handleAddNew}
        onViewDetails={handleViewDetails}
      />
      
      <ProjectForm 
        open={formOpen}
        onClose={handleCloseForm}
        project={selectedProject}
      />
      
      <ProjectDetails 
        open={detailsOpen}
        onClose={handleCloseDetails}
        projectId={selectedProjectId}
      />
    </PageShell>
  );
};

export default ProjectsPage;
