import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from './database.service';
import { SoftlandGatewayService } from './softland-gateway.service';
import { ConfigService } from '@nestjs/config';

interface Proforma {
  id: number;
  numeroSecuenciaCalculo: string;
  estado: ProformaEstado;
  tipoCalculo: string;
  fechaEjecucion: string;
  contratos: CalculoContrato[];
}

interface CalculoContrato {
  id: number;
  periodoId: number;
  fechaHastaPeriodoCalculado: string;
  fechaDesdePeriodoCalculado: string;
  contrato: {
    cliente: { codigo: string; id: number } | null;
    sociedad?: { conceptoBusqueda: string; id: number } | null;
  } | null;
  conceptos: CalculoContratoConcepto[];
  periodo: {
    id: number;
  };
}

interface CalculoContratoConcepto {
  id: number;
  productoSoftland: {
    agrupacion: string;
    codigo: string;
  } | null;
  cantidad: number | null;
  importe: number | null;
  procedimientoP: {
    moneda: { codigo: string; id: number } | null;
  } | null;
}

export enum ProformaEstado {
  PENDIENTE_DE_ENVIO = 'PENDIENTE_DE_ENVIO',
  EN_PROCESO = 'EN_PROCESO',
  ENVIADO = 'ENVIADO',
  ERROR_DE_VALIDACION = 'ERROR_DE_VALIDACION',
  ERROR_ENVIO_SOFTLAND = 'ERROR_ENVIO_SOFTLAND',
}

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly softlandGatewayService: SoftlandGatewayService,
    private configService: ConfigService,
  ) {}

  @Cron('*/1 * * * *') // Ejecuta cada minuto
  async handleCron() {
    this.logger.debug(`Iniciado proceso billing-extractor (${new Date()})`);
    await this.processOneRow();
  }

  async processOneRow(): Promise<void> {
    try {
      const proforma = await this.getProformaPendiente();
      if (!proforma) return;

      const payloadEnProceso = this.crearPayloadActualizacion(
        proforma,
        ProformaEstado.EN_PROCESO,
      );

      await this.actualizarEstadoProforma(payloadEnProceso);

      const errores = this.validarProforma(proforma);

      if (errores.length > 0) {
        this.logger.error(`Errores de validación: ${errores.join(', ')}`);
        const payload = this.crearPayloadActualizacion(
          proforma,
          ProformaEstado.ERROR_DE_VALIDACION,
        );
        await this.actualizarEstadoProforma(payload);

        return;
      }

      try {
        const calculoCabeceraId = proforma.id;
        const tituloCsv = `soporte_calculoCabeceraId_${calculoCabeceraId}.csv`;
        const proformaToSoftland = this.mapProformaToSoftland(
          proforma,
          tituloCsv,
        );
        await this.databaseService.exportarCsvSoporteProforma(
          calculoCabeceraId,
          tituloCsv,
        );
        await this.enviarProformaASoftland(proformaToSoftland);

        const payload = this.crearPayloadActualizacion(
          proforma,
          ProformaEstado.ENVIADO,
          tituloCsv,
        );
        await this.actualizarEstadoProforma(payload);
      } catch (err) {
        this.logger.error('Error enviando a Softland', err);

        const payloadSoftlandError = this.crearPayloadActualizacion(
          proforma,
          ProformaEstado.ERROR_ENVIO_SOFTLAND,
        );

        await this.actualizarEstadoProforma(payloadSoftlandError);
      }
    } catch (err) {
      this.logger.error(
        'Error durante el procesamiento de una proforma',
        err.stack,
      );
    }
  }

  private validarProforma(proforma: Proforma): string[] {
    const errores: string[] = [];

    const contrato = proforma.contratos?.[0];

    if (!contrato) {
      errores.push('No existe contrato en la proforma');
      return errores;
    }

    if (!contrato.contrato?.cliente?.codigo) {
      errores.push('Cliente sin código');
    }

    if (!contrato.conceptos?.length) {
      errores.push('No existen conceptos');
    }

    contrato.conceptos?.forEach((c, index) => {
      if (!c.productoSoftland) {
        errores.push(`Concepto ${c.id} sin productoSoftland`);
      }

      if (!c.procedimientoP?.moneda?.codigo) {
        errores.push(`Concepto ${c.id} sin moneda`);
      }

      if (c.importe == null) {
        errores.push(`Concepto ${c.id} sin importe`);
      }

      if (c.cantidad == null) {
        errores.push(`Concepto ${c.id} sin cantidad`);
      }
    });

    return errores;
  }

  private async getProformaPendiente(): Promise<Proforma | null> {
    const proforma = await this.databaseService.getProformaPendienteDeEnvio();
    if (!proforma) {
      this.logger.warn(
        'No se encontraron proformas con estado "PENDIENTE_DE_ENVIO"',
      );
      return null;
    }
    return proforma;
  }

  private mapProformaToSoftland(proforma: Proforma, tituloCsv: string) {
    let rutaBase = this.configService.get('URL_CSV_SOPORTE_PROFORMA');

    this.logger.debug(
      `Proforma completa:\n${JSON.stringify(proforma, null, 2)}`,
    );

    this.logger.debug(
      `Conceptos:\n${JSON.stringify(
        proforma.contratos?.[0]?.conceptos,
        null,
        2,
      )}`,
    );

    return {
      header: {
        numeroSecuencia: proforma.numeroSecuenciaCalculo,
        fecha: proforma.contratos[0].fechaHastaPeriodoCalculado,
        fechaServicioDesde: proforma.contratos[0].fechaDesdePeriodoCalculado,
        fechaServicioHasta: proforma.contratos[0].fechaHastaPeriodoCalculado,
        cliente: proforma.contratos[0].contrato.cliente.codigo,
        comprobanteAGenerar: 'PROGMB', // VALOR FIJO
        circuitoAGenerar: '001', // VALOR FIJO
        descriptores: null, // VALOR FIJO
        unidadNegocio: 'MUSAPA', // VALOR FIJO
        moneda:
          proforma.contratos[0].conceptos[0]?.procedimientoP?.moneda?.codigo,
        observaciones: null, // VALOR FIJO
        adjunto: rutaBase.replace(/[\\\/]$/, '') + '\\' + tituloCsv,
        procesado: false, // VALOR FIJO
        empresa: proforma.contratos[0].contrato?.sociedad?.conceptoBusqueda,
        moduloComprobante: null, // VALOR FIJO
        codigoComprobante: null, // VALOR FIJO
        numeroComprobante: null, // VALOR FIJO
      },
      items: proforma.contratos[0].conceptos.map((concepto) => ({
        numeroSecuencia: proforma.numeroSecuenciaCalculo,
        numeroItem: concepto.id,
        tipoProducto: concepto.productoSoftland.agrupacion.slice(0, 6),
        codigoProducto: concepto.productoSoftland.codigo.slice(0, 30),
        cantidad: concepto.cantidad,
        precio: concepto.importe,
        bonificacion: 0, // VALOR FIJO
      })),
    };
  }

  private async enviarProformaASoftland(
    proformaToSoftland: any,
  ): Promise<void> {
    try {
      await this.softlandGatewayService.envioProforma(proformaToSoftland);
      this.logger.debug('Proforma enviada a Softland exitosamente');
    } catch (err) {
      this.logger.error('Error enviando proforma a Softland', err);
      throw err;
    }
  }

  private crearPayloadActualizacion(
    proforma: Proforma,
    estado: string,
    tituloCsv?: string,
  ) {
    const payload: any = {
      calculoContratoId: proforma.contratos[0].id,
      calculoCabeceraId: proforma.id,
      periodoId: proforma.contratos[0].periodo.id,
      estado,
    };

    if (tituloCsv) {
      payload.tituloCsv = tituloCsv;
    }

    return payload;
  }

  private async actualizarEstadoProforma(payload: any): Promise<void> {
    try {
      await this.databaseService.updateEstadoProforma(payload);
      this.logger.debug(
        `Estado de la proforma actualizado a "${payload.estado}"`,
      );
    } catch (err) {
      this.logger.error('Error actualizando el estado de la proforma', err);
      throw err;
    }
  }
}
