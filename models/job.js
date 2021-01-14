"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, companyHandle }
   *
   * Returns { id, title, salary, equity, companyHandle }
   * 
   * Throws BadRequestError if comapanyHandle doesn't exist
   * */

  static async create({ title, salary, equity, companyHandle }) {
    const checkCompanyExists = await db.query(
      `SELECT handle
       FROM companies
       WHERE handle = $1`,
      [companyHandle]);
    if (checkCompanyExists.rows[0] === undefined) {
      throw new BadRequestError(`Company does not exist: ${companyHandle}`);
    }

    const result = await db.query(
      `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, salary, equity, company_handle AS "companyHandle"`,
      [
        title,
        salary,
        equity,
        companyHandle
      ],
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs.
   * 
   * Takes in optional filter object which can include:
   *  { }
   * 
   * Returns [{ id, title, salary, equity, companyHandle }, ...]
   * */

  static async findAll() {
    const jobRes = await db.query(
      `SELECT id,
              title, 
              salary, 
              equity, 
              company_handle AS "companyHandle"
           FROM jobs
           ORDER BY title`);
    return jobRes.rows;
  }

  /** Given a job id, return data about the job.
   *
   * Returns { id, title, salary, equity, companyHandle }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const jobRes = await db.query(
      `SELECT id,
              title, 
              salary, 
              equity, 
              company_handle AS "companyHandle"
           FROM jobs
           WHERE id = $1`,
      [id]);

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, salary, equity}
   *
   * Returns {id, title, salary, equity, companyHandle }
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(
      data);
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id, 
                                title, 
                                salary, 
                                equity, 
                                company_handle AS "companyHandle"`;
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Delete given job from database; returns undefined.
   *
   * Throws NotFoundError if job not found.
   **/

  static async remove(id) {
    const result = await db.query(
      `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
      [id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }

  /** Translate data to filter into SQL Format. 
   * Takes in:
   *  filterBy: JS object with key-value pairs to filter in database
   * 
   * Returns:
   *  whereCols: string that contains the where clause of the SQL query 
   *             if filterBy has minEmployees, maxEmployees or name
   *             - empty string if the keys above are not present
   *  values: array of values to search by in the SQL query
   *          - empty array if keys are not present
   *  
   *  Example: 
   * { 
   *    whereCols: "WHERE num_employees >= $1 AND name ILIKE $2",
   *    values: [4, '%searchTerm%']
   * }
   * 
  */

  static _sqlForPartialFilter(filters = {}) {
    if (Object.keys(filters).length === 0) {
      return {
        whereClauses: '',
        values: [],
      }
    }

    const whereClauses = [];
    const values = [];
    const { minEmployees, maxEmployees, name } = filters;

    if (minEmployees && maxEmployees && +minEmployees > +maxEmployees) {
      throw new BadRequestError(
        `Min employees: ${minEmployees} cannot be larger than max 
        employees: ${maxEmployees}`);
    }

    if (minEmployees !== undefined) {
      whereClauses.push(`num_employees >= $${whereClauses.length + 1}`);
      values.push(minEmployees);
    }

    if (maxEmployees !== undefined) {
      whereClauses.push(`num_employees <= $${whereClauses.length + 1}`);
      values.push(maxEmployees);
    }

    if (name !== undefined) {
      whereClauses.push(`name ILIKE $${whereClauses.length + 1}`);
      values.push(`%${name}%`);
    }

    return {
      whereClauses: 'WHERE ' + whereClauses.join(" AND "),
      values,
    };
  }
}


module.exports = Job;