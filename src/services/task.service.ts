import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from './database.service';
import { SoftlandGatewayService } from './softland-gateway.service';

// interface Proforma {
//   id: number;
//   numeroSecuenciaCalculo: string;
//   contratos: {
//     id: number;
//     periodoId: number;
//     fechaHastaPeriodoCalculado: string;
//     fechaDesdePeriodoCalculado: string;
//     contrato: {
//       cliente: { codigo: string };
//     };
//     conceptos: {
//       id: number;
//       productoSoftland: {
//         agrupacion: string;
//         codigo: string;
//       };
//       cantidad: number;
//       importe: number;
//       procedimientoP: {
//         moneda: { codigo: string };
//       };
//     }[];
//   }[];
// }

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly softlandGatewayService: SoftlandGatewayService,
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

      const proformaToSoftland = this.mapProformaToSoftland(proforma);

      await this.enviarProformaASoftland(proformaToSoftland);

      const payload = this.crearPayloadActualizacion(proforma);
      await this.actualizarEstadoProforma(payload);
    } catch (err) {
      this.logger.error(
        'Error durante el procesamiento de una proforma',
        err.stack,
      );
    }
  }

  private async getProformaPendiente(): Promise<any | null> {
    const proforma = await this.databaseService.getProformaPendienteDeEnvio();
    if (!proforma) {
      this.logger.warn(
        'No se encontraron proformas con estado "PENDIENTE_DE_ENVIO"',
      );
      return null;
    }
    return proforma;
  }

  private mapProformaToSoftland(proforma: any) {
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
          proforma.contratos[0].conceptos[0]?.procedimientoP.moneda.codigo,
        observaciones: null, // VALOR FIJO
        adjunto: 'RUTA PENDIENTE', //TODO todavia no tenemos la ruta al servidor
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

  private crearPayloadActualizacion(proforma: any) {
    return {
      calculoContratoId: proforma.contratos[0].id,
      calculoCabeceraId: proforma.id,
      periodoId: proforma.contratos[0].periodo.id,
      estado: 'ENVIADO',
    };
  }

  private async actualizarEstadoProforma(payload: any): Promise<void> {
    try {
      await this.databaseService.updateEstadoProforma(payload);
      this.logger.debug('Estado de la proforma actualizado a "ENVIADO"');
    } catch (err) {
      this.logger.error(
        'Error actualizando el estado de la proforma',
        err,
      );
      throw err;
    }
  }
}
