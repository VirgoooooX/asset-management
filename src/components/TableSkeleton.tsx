import React from 'react'
import { Skeleton, TableCell, TableRow } from '@mui/material'

export interface TableSkeletonProps {
  rows?: number
  columns: number
}

const WIDTHS = ['60%', '85%', '50%', '72%', '65%', '90%', '55%', '78%']

const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={`skeleton-row-${rowIdx}`}>
          {Array.from({ length: columns }).map((__, colIdx) => (
            <TableCell key={`skeleton-cell-${rowIdx}-${colIdx}`}>
              <Skeleton variant="text" width={WIDTHS[(rowIdx + colIdx) % WIDTHS.length]} height={22} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export default TableSkeleton
