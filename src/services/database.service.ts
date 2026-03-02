import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, lastValueFrom, of,map,  } from 'rxjs';
import { AxiosResponse ,AxiosRequestConfig} from 'axios';
import { join } from 'path';
import { writeFileSync } from 'fs';



@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  private baseUrl: string;

  private axiosConfig: AxiosRequestConfig = {
    headers: { Authorization: `` },
    timeout: 15000,
  };

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    const token = '';
    this.axiosConfig.headers = { Authorization: `Bearer ${token}` };
    this.baseUrl = this.configService.get<string>('BS_BASE_URL');

    if (!this.baseUrl) {
      throw new Error('BS_BASE_URL no está definida');
    }
  }

  // getProformaPendienteDeEnvio = async () => {
  //   const url =
  //     this.baseUrl + this.configService.get('BS_PROFORMA_PENDIENTE_DE_ENVIO');

  //   let config = { ...this.axiosConfig };

  //   return lastValueFrom(
  //     this.httpService.get(url, config).pipe(
  //       map((axiosResponse: AxiosResponse) => {
  //         return axiosResponse.data;
  //       }),

  //       catchError((err) => {
  //         this.logger.error('->getProformaPendienteDeEnvio', err);
  //         return of(null);
  //       }),
  //     ),
  //   );
  // };
  getProformaPendienteDeEnvio = async () => {
  const path = this.configService.get<string>('BS_PROFORMA_PENDIENTE_DE_ENVIO');
  const url = `${this.baseUrl}${path}`;

  console.log('🔹 URL que se va a llamar:', url);
  console.log('🔹 Config usada:', this.axiosConfig);

  const config = { ...this.axiosConfig };

  return lastValueFrom(
    this.httpService.get(url, config).pipe(
      map((axiosResponse: AxiosResponse) => {
        console.log('Respuesta HTTP status:', axiosResponse.status);
        console.log('Headers recibidos:', axiosResponse.headers);
        console.log('Datos recibidos:', axiosResponse.data);
        return axiosResponse.data;
      }),
      catchError((err) => {
        console.error('Error en getProformaPendienteDeEnvio');
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        console.error('Response data:', err.response?.data);
        console.error('Response status:', err.response?.status);
        console.error('Config usada en la petición:', err.config);
        return of(null);
      }),
    ),
  );
};

  async updateEstadoProforma(data: any) {
    const url = this.baseUrl + this.configService.get('BS_UPDATE_ESTADO_PROFORMA');
    let config = { ...this.axiosConfig };

    try {
      const axiosResponse: AxiosResponse = await lastValueFrom(
        this.httpService.put(url, data, config),
      );
      return axiosResponse.data;
    } catch (err) {
      this.logger.error('Error en la actualización de estado', err);

      if (err.response && err.response.data) {
        throw new BadRequestException({
          message:
            err.response.data.message ||
            'Error desconocido en la actualización de estado',
          error: 'Bad Request',
          statusCode: 400,
        });
      } else {
        throw new InternalServerErrorException(
          'Error de conexión o de la base de datos',
        );
      }
    }
  }

  async exportarCsvSoporteProforma(calculoContratoId: number, tituloCsv: string) {
    const url = this.baseUrl + this.configService.get('BS_EXPORT_CSV_SOPORTE_PROFORMA') + calculoContratoId;

    let config = { ...this.axiosConfig };

    try {
        const response: AxiosResponse = await lastValueFrom(
            this.httpService.get(url, config), 
        );
        const isServer = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production';
        
        const dirPath = isServer ? this.configService.get('DOWNLOAD_FOLDER_SOPORTE') : join(process.cwd(), this.configService.get('DOWNLOAD_FOLDER_SOPORTE')) ;
        const filePath = join(dirPath, tituloCsv);
        writeFileSync(filePath, response.data);

        this.logger.log(`Archivo CSV guardado en: ${filePath}`);
        this.logger.log('CSV generado correctamente:', response.data);
    } catch (err) {
        this.logger.error('Error al exportar CSV de soporte proforma:', err);
    }
  }


}
