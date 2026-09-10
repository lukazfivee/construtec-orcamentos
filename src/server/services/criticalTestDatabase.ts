import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { initialMigration } from '../migrations/001-initial';
import { clientsAndWorksMigration } from '../migrations/002-clients-works';
import { catalogManagementMigration } from '../migrations/003-catalog-management';
import { cleanExsatAdministrativeOcrMigration } from '../migrations/004-clean-exsat-admin-ocr';
import { proposalLaborMigration } from '../migrations/005-proposal-labor';
import { proposalItemCategoryMigration } from '../migrations/006-proposal-item-category';
import { kitsAndSettingsMigration } from '../migrations/007-kits-and-settings';
import { approvedProposalGuardsMigration } from '../migrations/008-approved-proposal-guards';
import { proposalIntegrationMigration } from '../migrations/009-proposal-integration';
import { createProposal } from './proposals';
import { createProposalLaborItem } from './proposalLabor';

export const createCriticalTestDatabase = async (protectApproved = true) => {
  const database = new PGlite();
  await database.exec([initialMigration, clientsAndWorksMigration, catalogManagementMigration,
    cleanExsatAdministrativeOcrMigration, proposalLaborMigration, proposalItemCategoryMigration,
    kitsAndSettingsMigration, proposalIntegrationMigration,
    protectApproved ? approvedProposalGuardsMigration : ''].join('\n'));
  const userId = randomUUID(), clientId = randomUUID(), workId = randomUUID();
  await database.query("INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,'Teste','fixture@example.invalid','not-a-password','admin')", [userId]);
  await database.query("INSERT INTO clients (id,legal_name,trade_name) VALUES ($1,'Cliente fictício','Cliente fictício')", [clientId]);
  await database.query("INSERT INTO works (id,client_id,name) VALUES ($1,$2,'Obra fictícia')", [workId, clientId]);
  const makeProposal = () => createProposal(database, { clientId, workId, scope: 'Escopo fictício' });
  const addMaterial = async (proposalId: string, quantity = '100', cost = '10', sale = '12.5') => {
    const id = randomUUID();
    await database.query(`INSERT INTO proposal_items
      (id,proposal_id,position,snapshot_code,snapshot_description,snapshot_unit,snapshot_unit_cost,quantity,sale_unit_price)
      VALUES ($1,$2,(SELECT COALESCE(MAX(position),0)+1 FROM proposal_items WHERE proposal_id=$2),
      $6,'Material fictício','m',$3,$4,$5)`, [id, proposalId, cost, quantity, sale, 'MAT-' + id]);
    return id;
  };
  const addLabor = (proposalId: string, plannedHours = 44) => createProposalLaborItem(database, proposalId, {
    description: 'Eletricista', professionalCount: 2, monthlySalary: 2600, monthlyFood: 600,
    monthlyTransport: 300, monthlyOtherCosts: 20, standardMonthlyHours: 176, plannedHours,
  }, userId);
  return { database, userId, clientId, workId, makeProposal, addMaterial, addLabor };
};
