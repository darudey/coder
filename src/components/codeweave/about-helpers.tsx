
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import React from 'react';

type FeatureCardProps = {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
};

export function FeatureCard({ title, icon, badge, children }: FeatureCardProps) {
    return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {icon}
              <span className="text-lg">{title}</span>
              {badge && <Badge variant="secondary">{badge}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            {children}
          </CardContent>
        </Card>
    );
}

type KeyProps = {
  children: React.ReactNode;
};

export function Key({ children }: KeyProps) {
    return (
        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
          {children}
        </kbd>
    );
}
