export const cleanExsatAdministrativeOcrMigration = `
  DELETE FROM products product
  WHERE product.source ILIKE 'EXSAT COD.%'
    AND (
      product.description ILIKE '%construtec%'
      OR product.description ILIKE '%construtora%'
      OR product.description ILIKE '%engenharia%'
      OR product.description ILIKE '%ltda%'
      OR product.description ILIKE '%cnpj%'
      OR product.description ILIKE '%orçamento%'
      OR product.description ILIKE '%orcamento%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM proposal_items item WHERE item.catalog_product_id = product.id
    );

  UPDATE products product
  SET active = false, updated_at = now()
  WHERE product.source ILIKE 'EXSAT COD.%'
    AND (
      product.description ILIKE '%construtec%'
      OR product.description ILIKE '%construtora%'
      OR product.description ILIKE '%engenharia%'
      OR product.description ILIKE '%ltda%'
      OR product.description ILIKE '%cnpj%'
      OR product.description ILIKE '%orçamento%'
      OR product.description ILIKE '%orcamento%'
    )
    AND EXISTS (
      SELECT 1 FROM proposal_items item WHERE item.catalog_product_id = product.id
    );
`;
