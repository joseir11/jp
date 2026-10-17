-- JP BURGUER | Funções públicas da página de comandas
-- Execute no SQL Editor do Supabase. Não altera nem recria tabelas existentes.

CREATE OR REPLACE FUNCTION public.get_comanda_details_by_id(p_comanda_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'comanda_id', c.id,
    'comanda_number', c.comanda_number,
    'customer_name', c.customer_name,
    'status', c.status,
    'total', c.total,
    'created_at', c.created_at,
    'closed_at', c.closed_at,
    'orders', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'order_id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'total', o.total,
          'created_at', o.created_at,
          'notes', o.notes,
          'items', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'item_id', oi.id,
                'product_name', oi.product_name,
                'unit_price', oi.unit_price,
                'quantity', oi.quantity,
                'subtotal', oi.subtotal
              ) ORDER BY oi.created_at
            )
            FROM public.order_items oi
            WHERE oi.order_id = o.id
          ), '[]'::jsonb)
        ) ORDER BY o.created_at
      )
      FROM public.orders o
      WHERE o.comanda_id = c.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.comandas c
  WHERE c.id = p_comanda_id;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_order_to_comanda_by_id(
  p_comanda_id uuid,
  p_items jsonb,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_name text;
  v_status text;
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_name text;
  v_price numeric(12,2);
  v_subtotal numeric(12,2);
  v_total numeric(12,2) := 0;
BEGIN
  SELECT c.customer_name, c.status
  INTO v_customer_name, v_status
  FROM public.comandas c
  WHERE c.id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada.';
  END IF;
  IF v_status <> 'ABERTA' THEN
    RAISE EXCEPTION 'Esta comanda já foi fechada.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'Adicione ao menos um produto (máximo de 30 itens por envio).';
  END IF;
  IF length(COALESCE(p_note, '')) > 500 THEN
    RAISE EXCEPTION 'A observação excede 500 caracteres.';
  END IF;

  INSERT INTO public.orders (customer_name, status, total, notes, comanda_id)
  VALUES (v_customer_name, 'NOVO', 0, NULLIF(trim(p_note), ''), p_comanda_id)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Produto ou quantidade inválidos.';
    END;

    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;

    SELECT p.name, p.price
    INTO v_product_name, v_price
    FROM public.products p
    WHERE p.id = v_product_id AND p.active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível ou não encontrado.';
    END IF;

    v_subtotal := v_price * v_quantity;
    v_total := v_total + v_subtotal;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, subtotal
    )
    VALUES (
      v_order_id, v_product_id, v_product_name, v_price, v_quantity, v_subtotal
    );
  END LOOP;

  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  UPDATE public.comandas
  SET total = (
    SELECT COALESCE(SUM(o.total), 0)
    FROM public.orders o
    WHERE o.comanda_id = p_comanda_id
  )
  WHERE id = p_comanda_id;

  RETURN v_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_comanda_public(p_comanda_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.comandas
  SET status = 'FECHADA', closed_at = NOW()
  WHERE id = p_comanda_id AND status = 'ABERTA';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada ou já fechada.';
  END IF;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_comanda_details_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_to_comanda_by_id(uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_comanda_public(uuid) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.open_comanda_public(p_customer_name text)
RETURNS TABLE(comanda_id uuid, comanda_number bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_customer_name IS NULL
     OR length(trim(p_customer_name)) < 2
     OR length(trim(p_customer_name)) > 100 THEN
    RAISE EXCEPTION 'Informe um nome válido.';
  END IF;

  RETURN QUERY
  INSERT INTO public.comandas (customer_name)
  VALUES (trim(p_customer_name))
  RETURNING public.comandas.id, public.comandas.comanda_number;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.open_comanda_public(text) TO anon, authenticated;


-- Lista todas as comandas abertas para a equipe.
CREATE OR REPLACE FUNCTION public.list_open_comandas()
RETURNS TABLE(id uuid, comanda_number bigint, customer_name text, total numeric, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT c.id, c.comanda_number, c.customer_name, c.total, c.created_at
  FROM public.comandas c
  WHERE c.status = 'ABERTA'
  ORDER BY c.created_at DESC;
$function$;

-- Exclui uma comanda aberta e todos os pedidos/itens vinculados, sem gerar histórico.
CREATE OR REPLACE FUNCTION public.delete_open_comanda(p_comanda_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM 1 FROM public.comandas
  WHERE id = p_comanda_id AND status = 'ABERTA'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada ou não está aberta.';
  END IF;

  DELETE FROM public.order_items
  WHERE order_id IN (SELECT id FROM public.orders WHERE comanda_id = p_comanda_id);
  DELETE FROM public.orders WHERE comanda_id = p_comanda_id;
  DELETE FROM public.comandas WHERE id = p_comanda_id AND status = 'ABERTA';
  RETURN TRUE;
END;
$function$;

-- Altera quantidade de item já lançado e recalcula os totais do pedido e da comanda.
CREATE OR REPLACE FUNCTION public.update_comanda_item_quantity(p_item_id uuid, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order_id uuid;
  v_comanda_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50 THEN
    RAISE EXCEPTION 'A quantidade deve estar entre 1 e 50.';
  END IF;

  SELECT oi.order_id, o.comanda_id INTO v_order_id, v_comanda_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.comandas c ON c.id = o.comanda_id
  WHERE oi.id = p_item_id AND c.status = 'ABERTA'
  FOR UPDATE OF oi, o, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado ou comanda fechada.';
  END IF;

  UPDATE public.order_items
  SET quantity = p_quantity, subtotal = unit_price * p_quantity
  WHERE id = p_item_id;

  UPDATE public.orders
  SET total = (SELECT COALESCE(SUM(subtotal),0) FROM public.order_items WHERE order_id = v_order_id)
  WHERE id = v_order_id;

  UPDATE public.comandas
  SET total = (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE comanda_id = v_comanda_id)
  WHERE id = v_comanda_id;

  RETURN TRUE;
END;
$function$;

-- Exclui item imediatamente; se era o último do pedido, remove também o pedido vazio.
CREATE OR REPLACE FUNCTION public.delete_comanda_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order_id uuid;
  v_comanda_id uuid;
BEGIN
  SELECT oi.order_id, o.comanda_id INTO v_order_id, v_comanda_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.comandas c ON c.id = o.comanda_id
  WHERE oi.id = p_item_id AND c.status = 'ABERTA'
  FOR UPDATE OF oi, o, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado ou comanda fechada.';
  END IF;

  DELETE FROM public.order_items WHERE id = p_item_id;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    DELETE FROM public.orders WHERE id = v_order_id;
  ELSE
    UPDATE public.orders
    SET total = (SELECT COALESCE(SUM(subtotal),0) FROM public.order_items WHERE order_id = v_order_id)
    WHERE id = v_order_id;
  END IF;

  UPDATE public.comandas
  SET total = (SELECT COALESCE(SUM(total),0) FROM public.orders WHERE comanda_id = v_comanda_id)
  WHERE id = v_comanda_id;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_open_comandas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_open_comanda(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_comanda_item_quantity(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_comanda_item(uuid) TO anon, authenticated;


-- Monta o cupom somente com itens das categorias CLÁSSICOS e ESPECIAIS.
CREATE OR REPLACE FUNCTION public.get_production_coupon(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'comanda_number', c.comanda_number,
    'customer_name', c.customer_name,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'description', COALESCE(p.description, '')
        ) ORDER BY oi.created_at
      )
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.categories cat ON cat.id = p.category_id
      WHERE oi.order_id = o.id
        AND (
          upper(trim(COALESCE(cat.name, ''))) IN ('CLÁSSICOS', 'ESPECIAIS')
          OR lower(trim(COALESCE(cat.slug, ''))) IN ('classicos', 'especiais')
        )
    ), '[]'::jsonb)
  )
  FROM public.orders o
  JOIN public.comandas c ON c.id = o.comanda_id
  WHERE o.id = p_order_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_production_coupon(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
