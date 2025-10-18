
'use client';

import React from 'react';
import { type TableData } from '@/lib/courses-data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TableEditorProps {
    data: TableData;
    onDataChange: (newData: TableData) => void;
}

export const TableEditor: React.FC<TableEditorProps> = ({ data, onDataChange }) => {
    
    const handleHeaderChange = (index: number, value: string) => {
        const newHeaders = [...data.headers];
        newHeaders[index] = value;
        onDataChange({ ...data, headers: newHeaders });
    };

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newRows = data.rows.map(row => [...row]);
        newRows[rowIndex][colIndex] = value;
        onDataChange({ ...data, rows: newRows });
    };

    const addColumn = () => {
        const newHeaders = [...data.headers, `Item ${data.headers.length}`];
        const newRows = data.rows.map(row => [...row, '']);
        onDataChange({ headers: newHeaders, rows: newRows });
    };

    const removeColumn = (index: number) => {
        if (data.headers.length <= 2) return; // Keep at least Feature and one Item column
        const newHeaders = data.headers.filter((_, i) => i !== index);
        const newRows = data.rows.map(row => row.filter((_, i) => i !== index));
        onDataChange({ headers: newHeaders, rows: newRows });
    };

    const addRow = () => {
        const newRows = [...data.rows.map(row => [...row]), Array(data.headers.length).fill('')];
        onDataChange({ ...data, rows: newRows });
    };

    const removeRow = (index: number) => {
        if (data.rows.length <= 1) return;
        const newRows = data.rows.filter((_, i) => i !== index);
        onDataChange({ ...data, rows: newRows });
    };

    return (
        <div className="my-4 border rounded-lg p-4 overflow-x-auto bg-background not-prose">
            <div className="min-w-[700px] flex flex-col gap-4">
                {/* Header Row */}
                <div className="flex gap-2 items-center">
                    {data.headers.map((header, index) => (
                        <div key={index} className="flex-1 relative group">
                            <Input
                                value={header}
                                onChange={(e) => handleHeaderChange(index, e.target.value)}
                                className="font-semibold border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-offset-0 text-sm h-9"
                                placeholder={index === 0 ? 'Feature' : `Item ${index}`}
                            />
                            {index > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-1/2 -right-1 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 rounded-full"
                                    onClick={() => removeColumn(index)}
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                            )}
                        </div>
                    ))}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addColumn}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                {/* Data Rows */}
                <div className="flex flex-col gap-2">
                    {data.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-2 items-center group">
                            {row.map((cell, colIndex) => (
                                <div key={colIndex} className="flex-1">
                                    <Input
                                        value={cell}
                                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                        className="border-input focus-visible:ring-1 focus-visible:ring-offset-0 text-sm h-9"
                                        placeholder={colIndex === 0 ? 'Feature Name' : 'Value'}
                                    />
                                </div>
                            ))}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 rounded-full"
                                onClick={() => removeRow(rowIndex)}
                            >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2 self-start" onClick={addRow}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Feature
                </Button>
            </div>
        </div>
    );
};
