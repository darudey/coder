
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
        const newHeaders = [...data.headers, `Header ${data.headers.length + 1}`];
        const newRows = data.rows.map(row => [...row, '']);
        onDataChange({ headers: newHeaders, rows: newRows });
    };

    const removeColumn = (index: number) => {
        if (data.headers.length <= 1) return;
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
        <div className="my-4 border rounded-lg p-4 overflow-x-auto">
            <div className="min-w-[600px]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {data.headers.map((header, index) => (
                                <TableHead key={index} className="relative group px-1.5">
                                    <Input
                                        value={header}
                                        onChange={(e) => handleHeaderChange(index, e.target.value)}
                                        className="font-bold border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1/2 -right-3 -translate-y-1/2 h-5 w-5 opacity-0 group-hover:opacity-100 rounded-full"
                                        onClick={() => removeColumn(index)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </TableHead>
                            ))}
                            <TableHead className="w-[40px] px-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addColumn}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex} className="group">
                                {row.map((cell, colIndex) => (
                                    <TableCell key={colIndex} className="px-1.5">
                                        <Input
                                            value={cell}
                                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                            className="border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0"
                                        />
                                    </TableCell>
                                ))}
                                <TableCell className="px-0">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 rounded-full"
                                        onClick={() => removeRow(rowIndex)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Button variant="ghost" size="sm" className="mt-2" onClick={addRow}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Row
                </Button>
            </div>
        </div>
    );
};
