"use client";

import { Button, Icon } from "./ui";

export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Icon name="doc" size={16} /> چاپ / ذخیره به‌صورت PDF
    </Button>
  );
}
