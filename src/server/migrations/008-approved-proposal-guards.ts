// Não recalcula nem regrava propostas existentes.
export const approvedProposalGuardsMigration = `
  CREATE OR REPLACE FUNCTION protect_approved_proposal() RETURNS trigger AS $$
  BEGIN
    IF OLD.status = 'approved' THEN
      IF TG_OP = 'DELETE' OR NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'PROPOSAL_LOCKED';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER approved_proposal_guard BEFORE UPDATE OR DELETE ON proposals
    FOR EACH ROW EXECUTE FUNCTION protect_approved_proposal();

  CREATE OR REPLACE FUNCTION protect_approved_proposal_line() RETURNS trigger AS $$
  DECLARE parent_id uuid; parent_status text;
  BEGIN
    -- Verifica ambos os pais: também impede mover linha de/para proposta aprovada.
    FOR parent_id IN
      SELECT DISTINCT id FROM unnest(ARRAY[
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.proposal_id ELSE NULL END,
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.proposal_id ELSE NULL END
      ]) AS parents(id) WHERE id IS NOT NULL ORDER BY id
    LOOP
      SELECT status INTO parent_status FROM proposals WHERE id = parent_id FOR UPDATE;
      IF parent_status = 'approved' THEN RAISE EXCEPTION 'PROPOSAL_LOCKED'; END IF;
    END LOOP;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER approved_material_guard BEFORE INSERT OR UPDATE OR DELETE ON proposal_items
    FOR EACH ROW EXECUTE FUNCTION protect_approved_proposal_line();
  CREATE TRIGGER approved_labor_guard BEFORE INSERT OR UPDATE OR DELETE ON proposal_labor_items
    FOR EACH ROW EXECUTE FUNCTION protect_approved_proposal_line();
`;
