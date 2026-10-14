import pool from '../config/db.js';
import TransactionModel from '../models/TransactionModel.js';

// 1. Dépôt
export const deposer = async (req, res) => {
  const { compte_id, montant, description } = req.body;

  if (!montant || montant <= 0) {
    return res.status(400).json({ error: 'Le montant doit être supérieur à 0.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [comptes] = await connection.execute(
      'SELECT statut, user_id FROM comptes_bancaires WHERE id = ?',
      [compte_id]
    );
    if (comptes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    if (comptes[0].statut !== 'actif') {
      await connection.rollback();
      return res.status(403).json({ error: 'Compte bloqué.' });
    }
    // Vérification de propriété : le compte doit appartenir à l'utilisateur connecté (sauf admin)
    if (comptes[0].user_id !== req.user.id && !req.user.is_admin) {
      await connection.rollback();
      return res.status(403).json({ error: 'Accès refusé : ce compte ne vous appartient pas.' });
    }

    await connection.execute(
      'UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?',
      [montant, compte_id]
    );

    const transactionId = await TransactionModel.create({
      compte_source_id: null,
      compte_destinataire_id: compte_id,
      type_transaction: 'depot',
      montant,
      description: description || 'Dépôt sur le compte'
    }, connection);

    await connection.commit();
    return res.status(201).json({ message: 'Dépôt effectué.', transactionId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: 'Erreur serveur lors du dépôt.' });
  } finally {
    connection.release();
  }
};

// 2. Retrait
export const retirer = async (req, res) => {
  const { compte_id, montant, description } = req.body;

  if (!montant || montant <= 0) {
    return res.status(400).json({ error: 'Le montant doit être supérieur à 0.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [comptes] = await connection.execute(
      'SELECT solde, statut, user_id FROM comptes_bancaires WHERE id = ?',
      [compte_id]
    );
    if (comptes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    if (comptes[0].statut !== 'actif') {
      await connection.rollback();
      return res.status(403).json({ error: 'Compte bloqué.' });
    }
    // Vérification de propriété : le compte doit appartenir à l'utilisateur connecté (sauf admin)
    if (comptes[0].user_id !== req.user.id && !req.user.is_admin) {
      await connection.rollback();
      return res.status(403).json({ error: 'Accès refusé : ce compte ne vous appartient pas.' });
    }
    if (Number(comptes[0].solde) < Number(montant)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    await connection.execute(
      'UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?',
      [montant, compte_id]
    );

    const transactionId = await TransactionModel.create({
      compte_source_id: compte_id,
      compte_destinataire_id: null,
      type_transaction: 'retrait',
      montant,
      description: description || 'Retrait espèces'
    }, connection);

    await connection.commit();
    return res.status(201).json({ message: 'Retrait effectué.', transactionId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: 'Erreur serveur lors du retrait.' });
  } finally {
    connection.release();
  }
};

// 3. Virement (virerVers)
export const virerVers = async (req, res) => {
  const { compte_source_id, dest_iban, montant, description } = req.body;

  if (!montant || montant <= 0) {
    return res.status(400).json({ error: 'Le montant doit être supérieur à 0.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Vérifier le compte source
    const [sources] = await connection.execute(
      'SELECT solde, statut, iban, user_id FROM comptes_bancaires WHERE id = ?',
      [compte_source_id]
    );
    if (sources.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Compte source introuvable.' });
    }
    if (sources[0].statut !== 'actif') {
      await connection.rollback();
      return res.status(403).json({ error: 'Compte source bloqué.' });
    }
    // Vérification de propriété : le compte source doit appartenir à l'utilisateur connecté (sauf admin)
    if (sources[0].user_id !== req.user.id && !req.user.is_admin) {
      await connection.rollback();
      return res.status(403).json({ error: 'Accès refusé : le compte source ne vous appartient pas.' });
    }
    if (sources[0].iban === dest_iban) {
      await connection.rollback();
      return res.status(400).json({ error: 'Impossible de faire un virement vers le même compte.' });
    }
    if (Number(sources[0].solde) < Number(montant)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Solde insuffisant.' });
    }

    // Chercher le compte destinataire par son IBAN
    const [destinataires] = await connection.execute(
      'SELECT id, statut FROM comptes_bancaires WHERE iban = ?',
      [dest_iban]
    );
    if (destinataires.length === 0 || destinataires[0].statut !== 'actif') {
      await connection.rollback();
      return res.status(404).json({ error: 'Compte destinataire introuvable ou bloqué.' });
    }
    const compte_dest_id = destinataires[0].id;

    // Débiter source et créditer destinataire
    await connection.execute(
      'UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?',
      [montant, compte_source_id]
    );
    await connection.execute(
      'UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?',
      [montant, compte_dest_id]
    );

    // Enregistrer la transaction
    const transactionId = await TransactionModel.create({
      compte_source_id: compte_source_id,
      compte_destinataire_id: compte_dest_id,
      type_transaction: 'virement_emis',
      montant,
      description: description || `Virement vers ${dest_iban}`
    }, connection);

    await connection.commit();
    return res.status(201).json({ message: 'Virement effectué avec succès.', transactionId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(500).json({ error: 'Erreur serveur lors du virement.' });
  } finally {
    connection.release();
  }
};

// 4. Historique et filtres
export const getHistorique = async (req, res) => {
  try {
    const { compteId } = req.params;
    const { dateDebut, dateFin, type } = req.query;

    // Vérifier que le compte existe et appartient bien à l'utilisateur connecté (sauf admin)
    const [comptes] = await pool.execute(
      'SELECT user_id FROM comptes_bancaires WHERE id = ?',
      [compteId]
    );
    if (comptes.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    if (comptes[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Accès refusé : ce compte ne vous appartient pas.' });
    }

    const transactions = await TransactionModel.filter({
      compteId,
      dateDebut,
      dateFin,
      type_transaction: type
    });

    return res.status(200).json(transactions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
  }
};

export default {
  deposer,
  retirer,
  virerVers,
  getHistorique
};