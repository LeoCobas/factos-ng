# Design Specification — Mercado Pago Import Modal UI & Behavior Adjustments

This document outlines the design and implementation details to refine the Mercado Pago import modal's UI responsiveness on mobile, remove automatic queries on init, and reduce default search range defaults.

## Context & Goals
During manual testing of the Mercado Pago batch invoicing integration, two issues were identified:
1. **Unsolicited Automatic Search**: Opening the modal triggers a payment search automatically across a default 30-day window. This is resource-intensive and shouldn't run until the user hits "Buscar Pagos".
2. **Date Range Default**: A 30-day default fallback is too broad. We will reduce this to a 7-day default range when no previous invoicing history exists.
3. **Mobile Layout Constraints**: The payments table has excessive width causing horizontal scroll on mobile, and the modal footer (containing summaries, the "Combinar cobros del mismo día" checkbox, and action buttons) overflows or wraps poorly.

---

## Proposed Changes

### 1. Behavior & Search Range

#### [MODIFY] [mercadopago.service.ts](file:///c:/PROYECTOS/factos-ng/src/app/core/services/mercadopago.service.ts)
- Update `getDefaultBeginDate` to fallback to `this.daysAgo(7)` instead of `this.daysAgo(30)` if no previous reconciliations exist.

#### [MODIFY] [mercadopago-import-modal.component.ts](file:///c:/PROYECTOS/factos-ng/src/app/features/facturar/mercadopago-import-modal.component.ts)
- Update the initialization `effect` inside the constructor. Keep date initialization logic (`getDefaultBeginDate`, `getDefaultEndDate`), but **remove** the automatic execution of `await this.buscarPagos()`.

---

### 2. Table Column Cleanup

#### [MODIFY] [mercadopago-import-modal.component.ts](file:///c:/PROYECTOS/factos-ng/src/app/features/facturar/mercadopago-import-modal.component.ts)
- Remove the "Cliente" column from the payments table header and body.
  - Delete `<th class="p-3">Cliente</th>`.
  - Delete the corresponding table data cell `<td class="p-3 text-muted-foreground whitespace-nowrap">{{ formatPayerName(p.payer) }}</td>`.

---

### 3. Mobile Responsiveness & Modal Size

#### [MODIFY] [mercadopago-import-modal.component.ts](file:///c:/PROYECTOS/factos-ng/src/app/features/facturar/mercadopago-import-modal.component.ts)
- Modify the modal container styling:
  - Replace `max-w-4xl max-h-[90vh]` with `w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl` on the outer card container to make it full-screen on mobile.
- Adjust body spacing:
  - Change `p-6 space-y-6` to `p-4 sm:p-6 space-y-4 sm:space-y-6`.
- Refactor the footer controls:
  - Replace `class="flex items-center justify-between w-full"` with `class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between w-full"`.
  - Stacking layout for the checkbox/button controls:
    ```html
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
      <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
        <input
          type="checkbox"
          [checked]="combinarPorDia()"
          (change)="combinarPorDia.set(!combinarPorDia())"
          class="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
        />
        <span>Combinar cobros del mismo día</span>
      </label>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button type="button" (click)="cerrar()" class="btn-secondary rounded-lg px-4 py-2 text-sm font-semibold border border-border">
          Cancelar
        </button>
        <button type="button" (click)="procesarLote()" ...>
          Procesar Lote
        </button>
      </div>
    </div>
    ```

---

## Verification Plan

### Automated Tests
- Run `npm test` to verify that existing test suites remain unaffected and compile successfully.

### Manual Verification
- Open the modal and verify it opens immediately without making a request.
- Check that default range fallback defaults to exactly 7 days prior.
- Check mobile viewports in Chrome DevTools: verify that the modal is full-screen, the table does not have large lateral scroll, and the buttons/checkbox are correctly stacked.
